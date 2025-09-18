const express = require('express');
const router = express.Router();
const SellingProduct = require('../schemas/selling_product.js');
const placeEmbedding = require('../schemas/place_embedding.js');
const User = require('../schemas/user.js');
var { fetchPlaces } = require('./firebase/firebase_place_embedding.js');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const axios = require('axios');
var _ = require('lodash');
const fuzz = require('fuzzball');
const fs = require('fs').promises;
const cron = require('node-cron');
const CACHE_FILE = '/home/ubuntu/danim_database/kkday_products_cache.json';
const OpenAI = require('openai');

const KKDAY_BASE_URL = 'https://api-b2d.kkday.com/v4';
const KKDAY_API_KEY = process.env.KKDAY_API_KEY;

// === 캐시 로드 ===
let productCache = [];

tendencyData = [
    ['나홀로', '연인과', '친구와', '가족과', '효도', '자녀와'],
    ['힐링', '활동적인', '배움이 있는', '맛있는', '교통이 편한', '알뜰한'],
    ['레저 스포츠', '산책', '드라이브코스', '이색체험', '쇼핑', '시티투어', '역사 여행'],
    ['바다', '산', '자연경관', '문화시설', '사진 명소', '전통'],
    ['봄', '여름', '가을', '겨울'],
];

// KKday API 호출 헬퍼 - get
async function kkdayGet(endpoint, params = {}) {
    const { data } = await axios.get(`${KKDAY_BASE_URL}/${endpoint}`, {
        headers: {
            Authorization: KKDAY_API_KEY,
            'Content-Type': 'application/json',
        },
        params, // GET 요청에서는 body가 아니라 params로 전달
    });
    return data;
}

// KKday API 호출 헬퍼 - post
async function kkdayPost(endpoint, body = {}) {
    const { data } = await axios.post(`${KKDAY_BASE_URL}/${endpoint}`, body, {
        headers: {
            Authorization: KKDAY_API_KEY,
            'Content-Type': 'application/json',
        },
    });
    return data;
}

// 문자열에서 괄호와 그 안의 내용을 제거하는 함수
function removeParentheses(str) {
    return str.replace(/\(.*$/g, '').trim();
}

// 괄호 안의 내용 제거 후 공백 제거
function normalizePlaceName(place) {
    return removeParentheses(place).replace(/\s+/g, '');
}

// OpenAI API 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 관광지 이름 전처리
function normalizePlaceName(name) {
    if (!name) return ''; // null, undefined 방지
    if (typeof name !== 'string') {
        // 객체라면 {name:"..."} 구조에서 name 추출
        if (name.name && typeof name.name === 'string') {
            name = name.name;
        } else {
            return '';
        }
    }

    return name
        .toLowerCase()
        .replace(/\s+/g, '') // 공백 제거
        .replace(/\(.*?\)/g, '') // 괄호 내용 제거
        .trim();
}

function flattenPath(path) {
    return path.flatMap((day) => day.map((place) => place.name));
}

// ✅ 코사인 유사도 계산
function cosineSimilarity(vecA, vecB) {
    const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const normB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dot / (normA * normB);
}

function normalizePlaces(placeList) {
    if (Array.isArray(placeList)) {
        // 이미 배열이면 그대로 반환
        return placeList;
    } else if (typeof placeList === 'object' && placeList !== null) {
        // // object면 key와 value 모두 후보로 뽑음
        // return [...Object.keys(placeList), ...Object.values(placeList)];
        // object면 key만 후보로 뽑음
        return [...Object.keys(placeList)];
    } else {
        return [];
    }
}

async function embedText(texts) {
    //OpenAI Embeddings API는 input 배열 길이에 제한(최대 2048개) + 토큰 수 제한
    //장소명이 3,637개면 그대로 넣으면 무조건 400 에러
    if (!Array.isArray(texts)) texts = [texts];

    const BATCH_SIZE = 100; // 한 번에 보낼 개수 제한
    const embeddings = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const res = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: batch,
        });
        embeddings.push(...res.data.map((d) => d.embedding));
    }

    return embeddings;
}

// asyncPool 유틸
async function asyncPool(poolLimit, array, iteratorFn) {
    const ret = [];
    const executing = [];

    for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        ret.push(p);

        if (poolLimit <= array.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= poolLimit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(ret);
}

// 코스 벡터 생성 (MongoDB에서 place 임베딩 가져오기)
async function getCourseEmbedding(normCourse) {
    const embeddings = [];

    for (const place of normCourse) {
        const doc = await placeEmbedding.findOne({ place: place.name });
        if (doc && doc.embedding) embeddings.push(doc.embedding);
    }

    if (embeddings.length === 0) return null;

    return averageVectors(embeddings); // 단순 평균 or 가중 평균
}
async function getPlaceEmbedding(place) {
    const doc = await placeEmbedding.findOne({ place: place.name });
    return doc ? doc.embedding : null;
}

async function getPlaceEmbeddingsBulk(placeNames) {
    // placeNames: ["경복궁", "북촌 한옥마을", ...]
    const docs = await placeEmbedding.find({ place: { $in: placeNames } });

    // placeName → embedding 맵
    const map = {};
    for (const doc of docs) {
        map[doc.place] = doc.embedding;
    }
    return map;
}

function minMaxScale(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (max === min) return arr.map(() => 1); // 모두 같은 값이면 1로 스케일
    return arr.map((v) => (v - min) / (max - min));
}

function softmax(arr) {
    const expArr = arr.map((v) => Math.exp(v));
    const sum = expArr.reduce((a, b) => a + b, 0);
    return expArr.map((v) => v / sum);
}

// KKday 국가·도시 코드 변환 함수
function findKKdayCode(countryData, { countryInput, cityInput }) {
    if (!countryInput) return { country_code: null, city_code: null };

    const isCodeFormat = (str) => /^A\d{2}-\d{3,}$/.test(str);

    // 국가 코드 직접 입력
    if (isCodeFormat(countryInput)) {
        if (!cityInput) return { country_code: countryInput };
        if (Array.isArray(cityInput)) {
            const codes = cityInput.filter((c) => c); // 존재 여부는 API에서 체크
            return { country_code: countryInput, city_code: codes.length ? codes : undefined };
        }
        return { country_code: countryInput, city_code: [cityInput] };
    }

    // 국가명 검색
    const country = countryData.countries.find(
        (c) => c.country_name.trim().toLowerCase() === countryInput.trim().toLowerCase()
    );
    if (!country) return { error: `국가 "${countryInput}"를 찾을 수 없습니다.` };

    // 도시 입력 없으면 국가 코드만 반환
    if (!cityInput) return { country_code: country.country_code };

    // 도시 배열이면 매칭되는 것만 반환
    if (Array.isArray(cityInput)) {
        const codes = cityInput
            .map((cityName) => {
                if (isCodeFormat(cityName)) return cityName;
                const city = country.cities.find(
                    (ct) => ct.city_name.trim().toLowerCase() === cityName.trim().toLowerCase()
                );
                return city ? city.city_code : null;
            })
            .filter(Boolean);

        // 매칭되는 도시가 하나도 없으면 undefined → 국가 전체 검색
        return { country_code: country.country_code, city_code: codes.length ? codes : undefined };
    }

    // 단일 도시명
    if (isCodeFormat(cityInput)) return { country_code: country.country_code, city_code: [cityInput] };

    const city = country.cities.find((ct) => ct.city_name.trim().toLowerCase() === cityInput.trim().toLowerCase());

    // 매칭 안 되면 도시 코드 없이 국가 코드만 반환
    if (!city) return { country_code: country.country_code };

    return { country_code: country.country_code, city_code: [city.city_code] };
}

async function isNationwideProduct(product) {
    const prompt = `
상품명: ${product.prod_name}
상품 설명: ${product.introduction || ''}

이 상품이 해당 나라 전역에서 사용할 수 있는 상품(예: 전철 패스, eSIM 등)인지 0 또는 1로 알려줘.
0: 아니오
1: 전국용
`;
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1,
        });
        return completion.choices[0].message.content.trim() === '1';
    } catch {
        return false;
    }
}

// 판매 상품 목록 추천받기 ( 5개씩 )
// 프론트에서 다이어로그를 띄우기 전에 먼저 이 API를 쏘고, 결과가 있으면 띄움 ( AI 실행 로딩 때 같이 쏘면 될듯 )
router.post('/recommend', async (req, res) => {
    try {
        const { pathList, country, cityList, selectList, topK = 5 } = req.body;

        console.log('productCache.length');
        console.log(productCache.length);

        let selectedTendencies = [];

        if (selectList) {
            selectedTendencies = tendencyData.flatMap((row, i) => row.filter((val, j) => selectList[i][j] === 1));
            console.log(selectedTendencies);
        }

        // 1. 국가/도시 필터링
        let filteredProducts = productCache.filter((p) => p.countries.some((c) => c.name === country));
        // cities 배열 중에 cityList에 포함된 게 하나라도 있으면 통과
        if (cityList && cityList.length > 0 && !cityList.includes('전체')) {
            filteredProducts = filteredProducts.filter((product) =>
                product.countries.some((country) =>
                    country.cities.some((city) => city.name === '모든 도시' || cityList.includes(city.name))
                )
            );
        }

        // 전국용 상품 따로 빼두고 나중에 추가
        const nationwideProducts = filteredProducts.filter((p) => p.isNationwide);

        filteredProducts = filteredProducts.filter((p) => !p.isNationwide);

        console.log('filteredProducts.length');
        console.log(filteredProducts.length);

        let recommendProducts = [];

        for (const path of pathList) {
            console.time('duration_time');

            const pathFlat = flattenPath(path);

            // 코스 장소 임베딩 미리 한번에 가져오기 - 어차피 코스는 다 같음
            const placeMap = await getPlaceEmbeddingsBulk(pathFlat);

            const placeEmbeddings = pathFlat.map((p) => placeMap[p]).filter(Boolean);
            if (!placeEmbeddings.length) return 0;

            // 1. 캐싱된 normalizedPlaces를 활용한 빠른 매칭
            const results = await asyncPool(5, filteredProducts, async (product) => {
                try {
                    // is_essential or p.category === 5 인 경우만 임베딩으로 추가 가중치
                    // TODO - API 실행 시간이 여유있다면 category가 0이 아닌 경우로 바꾸기?
                    const essentialPlaces = path
                        .flatMap((day) => day.filter((p) => p.is_essential || (p.category && p.category === 5)))
                        .map((p) => p.name);

                    // essential 비율 계산
                    const essentialRatio = essentialPlaces.length / pathFlat.length; // 0 ~ 1

                    // essential 제외한 non-essential 장소들만 추출
                    const nonEssentialPlaces = pathFlat.filter((p) => !essentialPlaces.includes(p));

                    // pathFlat vs product.normalizedPlaces 매칭 (non-essential만)
                    const commonPlaces = nonEssentialPlaces.filter((place) =>
                        product.normalizedPlaces?.includes(place)
                    );

                    let nameMatchScore = 0;
                    if (commonPlaces.length > 0) {
                        nameMatchScore = commonPlaces.length / nonEssentialPlaces.length; // 단순 비율
                    }

                    let vectorScoreCourse = nameMatchScore;

                    if (essentialPlaces.length > 0) {
                        // essential 장소들에 대해 임베딩 직접 계산
                        const essentialEmbeddings = await embedText(essentialPlaces);

                        const validEmbeddings = essentialEmbeddings.filter(Boolean);

                        if (validEmbeddings.length > 0) {
                            const scores = validEmbeddings.map((emb) =>
                                cosineSimilarity(emb, product.productEmbedding)
                            );
                            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                            const maxScore = Math.max(...scores);
                            const embScore = avgScore * 0.2 + maxScore * 0.8;

                            // 이름 매칭과 임베딩을 비율대로 혼합
                            vectorScoreCourse = nameMatchScore * (1 - essentialRatio) + embScore * essentialRatio;
                        }
                    }

                    // 성향 점수
                    const avgPrefScore = selectedTendencies.length
                        ? selectedTendencies.reduce((sum, t) => sum + (product.tendencyScores[t] || 0), 0) /
                          selectedTendencies.length
                        : 0;

                    console.log(product.prod_name);
                    console.log(vectorScoreCourse);

                    return { ...product, vectorScoreCourse, avgPrefScore };
                } catch (err) {
                    console.error('추천 계산 중 오류', err);
                    return { ...product, vectorScoreCourse: 0, avgPrefScore: 0 };
                }
            });

            console.timeEnd('duration_time');

            // 2. 벡터, 성향 점수 배열
            const vectorScores = results.map((p) => p.vectorScoreCourse);
            const prefScores = results.map((p) => p.avgPrefScore);

            // 3. softmax 스케일링
            const softmaxVectorScores = softmax(vectorScores);
            const softmaxPrefScores = softmax(prefScores);

            // 4. finalScore 계산 (임계값 반영)
            const VECTOR_THRESHOLD = 0.4; // 코사인 유사도 최소 기준

            results.forEach((p, idx) => {
                const rawVector = vectorScores[idx]; // 절대 코사인 값
                const softVector = softmaxVectorScores[idx];
                const softPref = softmaxPrefScores[idx];

                // 임계값 미만이면 점수 0
                if (rawVector < VECTOR_THRESHOLD) {
                    p.finalScore = 0;
                } else {
                    // 절대 유사도와 softmax 랭킹 혼합
                    const vectorCombined = rawVector * 0.7 + softVector * 0.3;
                    const prefCombined = softPref; // 성향 점수는 softmax만 반영

                    // 최종 점수 (가중치 적용)
                    p.finalScore = vectorCombined * 0.8 + prefCombined * 0.2;
                }
            });

            // 5. 점수 순 정렬
            results.sort((a, b) => b.finalScore - a.finalScore);

            // topK + 전국용 상품 추가
            let topResults = results.slice(0, topK).concat(nationwideProducts.slice(0, 5));

            // productEmbedding 제거
            recommendProducts.push(topResults.map(({ productEmbedding, ...rest }) => rest));
        }
        res.json(recommendProducts);
    } catch (error) {
        console.error('/recommend API 오류:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 판매 상품 하나 가져오기
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        SellingProduct.findOne({ _id: id })
            .then(async (sellingProduct) => {
                if (!sellingProduct) {
                    return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
                }

                res.status(200).json(sellingProduct);
            })
            .catch((error) => {
                console.error('SellingProduct.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 sellingProductId 입니다.' });
            });
    } catch (error) {
        console.error('/sellingProduct/:id - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. 판매 상품 링크 클릭 로그 저장하기
router.patch('/linkClickLog', async (req, res) => {
    try {
        const { sellingProductId, clickLog } = req.body;

        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        SellingProduct.findOne({ _id: sellingProductId })
            .then(async (sellingProduct) => {
                if (!sellingProduct) {
                    return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
                }

                sellingProduct.sellingProductLinkClickLog.push(clickLog);

                await sellingProduct.save();

                res.status(200).json({ message: '판매 상품 링크 클릭 로그 저장 완료.' });
            })
            .catch((error) => {
                console.error('SellingProduct.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 sellingProductId 입니다.' });
            });
    } catch (error) {
        console.error('/sellingProduct/countLinkClick - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. 판매 상품 저장하기(관리자용) ( 관광지 이름은 저장할 때 다님 DB에 있는 관광지와 이름을 똑같이 맞춰야 함! )
router.post('/save', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const newSellingProduct = new SellingProduct(req.body);
        /*
        const {
            sellingProductName,
            sellingProductType,
            sellingProductContent,
            sellingProductContentDetail,
            sellingProductImage,
            sellingProductPrice,
            sellingProductPriceDetail,
            sellingProductPeriod,
            sellingProductHour,
            sellingProductRating,
            sellingProductReviewCount,
            sellingProductCountry,
            sellingProductCountryList,
            sellingProductRegion,
            sellingProductPlaceList,
            sellingProductCompany,
            sellingProductLink,
            sellingProductLinkList,
            koreanGuide,
        } = req.body;

        const newSellingProduct = new SellingProduct({
            sellingProductName: sellingProductName,
            sellingProductType: sellingProductType,
            sellingProductContent: sellingProductContent,
            sellingProductContentDetail: sellingProductContentDetail,
            sellingProductImage: sellingProductImage,
            sellingProductPrice: sellingProductPrice,
            sellingProductPriceDetail: sellingProductPriceDetail,
            sellingProductPeriod: sellingProductPeriod,
            sellingProductHour: sellingProductHour,
            sellingProductRating: sellingProductRating,
            sellingProductReviewCount: sellingProductReviewCount,
            sellingProductCountry: sellingProductCountry,
            sellingProductCountryList: sellingProductCountryList,
            sellingProductRegion: sellingProductRegion,
            sellingProductPlaceList: sellingProductPlaceList,
            sellingProductCompany: sellingProductCompany,
            sellingProductLink: sellingProductLink,
            sellingProductLinkList: sellingProductLinkList,
            koreanGuide: koreanGuide,
        });
*/
        const savedSellingProduct = await newSellingProduct.save();

        res.status(201).json({ sellingProductId: savedSellingProduct._id });
    } catch (error) {
        console.error('/sellingProduct/save - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 가격 문자열 → 숫자 변환
function parsePriceStringToNumber(str) {
    if (str == null) return 0; // null/undefined 처리
    if (typeof str === 'number') return str; // 이미 숫자이면 그대로 반환
    if (typeof str !== 'string') return 0; // 문자열이 아니면 0 처리

    return Number(str.replace(/[^\d]/g, '')) || 0;
}

// JSON을 모델 스키마 형식으로 변환
function transformDataToSellingProduct(data) {
    const priceEntries = Object.entries(data['가격'] || {}).map(([key, value]) => [
        key,
        parsePriceStringToNumber(value),
    ]);

    return {
        sellingProductName: data['판매상품이름'],
        sellingProductType: data['타입'],
        sellingProductContent: data['내용'],
        sellingProductContentDetail: data['세부내용'] || '',
        sellingProductContentDetailHTML: data['세부내용_raw_html'] || '',
        sellingProductImage: data['사진'] || [],
        sellingProductPrice: priceEntries.length > 0 ? Math.max(...priceEntries.map(([_, price]) => price)) : 0, // 가격 정보가 없을 경우 0으로 처리
        sellingProductPriceDetail: Object.fromEntries(
            Object.entries(data['가격'] || {}).map(([key, value]) => [
                key.replace(/\s/g, ''), // 필요에 따라 key 정제
                parsePriceStringToNumber(value),
            ])
        ),

        sellingProductPeriod: data['여행기간'] || 0,
        sellingProductHour: data['소요시간'] || 0,
        sellingProductRating: data['별점'] || 0.0,
        sellingProductReviewCount: data['리뷰'] || 0,
        sellingProductCountry: data['국가']?.[0] || '',
        sellingProductCountryList: data['국가'] || [],
        sellingProductRegion: data['지역'] || [],
        sellingProductPlaceList: data['관광지 리스트'] || ['전체'],
        sellingProductCompany: data['출처'] || '',
        sellingProductLink: data['링크'][0] || '',
        sellingProductLinkList: data['링크'] || [],
        koreanGuide: data['한국어 가이드 유무'] || 'N',
    };
}

// 소요시간 → 시간 단위 숫자 변환 (1시간 미만은 0)
function parseDuration(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;

    const str = String(value);

    // "숫자시간" 찾기
    const hourMatch = str.match(/(\d+)\s*시간/);
    if (hourMatch) {
        const hours = parseInt(hourMatch[1], 10);
        return hours >= 1 ? hours : 0;
    }

    // 1시간 미만은 0
    return 0;
}

// 가격 객체 → Map<string, Map<string, number>> 형태로 정규화
// 예) {"기본": 742}           → {"기본": {"기본": 742}}
//     {"옵션A": {"대인":1}}   → {"옵션A": {"대인":1}}
function buildPriceDetailMap(priceObjRaw) {
    const priceObj = priceObjRaw && typeof priceObjRaw === 'object' && !Array.isArray(priceObjRaw) ? priceObjRaw : {};

    const normalized = {};

    for (const [outerKeyRaw, innerRaw] of Object.entries(priceObj)) {
        const outerKey = String(outerKeyRaw).replace(/\s/g, '') || '기본';

        if (innerRaw && typeof innerRaw === 'object' && !Array.isArray(innerRaw)) {
            // 이미 세부 구분(대인/소인 등)이 있는 케이스
            const innerMap = {};
            for (const [k, v] of Object.entries(innerRaw)) {
                const cleaned = String(k).replace(/\s/g, '') || '기본';
                innerMap[cleaned] = parsePriceStringToNumber(v);
            }
            normalized[outerKey] = innerMap;
        } else {
            // 숫자(또는 숫자형 문자열) 단독 케이스 → 기본 서브키로 감싼다
            normalized[outerKey] = { 기본: parsePriceStringToNumber(innerRaw) };
        }
    }

    // 최종적으로 Mongoose Map< Map<number> >에 맞는 일반 객체 반환
    return normalized;
}

// JSON → 모델 스키마 형식으로 변환 - KKDAY
function transformDataToSellingProductKKDAY(data) {
    // 관광지 리스트: 배열/객체/없음 모두 처리 (객체면 key만)
    let placeList = ['전체'];
    const rawPlaces = data['관광지 리스트'];
    if (Array.isArray(rawPlaces)) {
        placeList = rawPlaces.map(String);
    } else if (rawPlaces && typeof rawPlaces === 'object') {
        placeList = Object.keys(rawPlaces);
    }

    // 가격 디테일(normalized)
    const priceDetailObj = buildPriceDetailMap(data['가격']);

    // 최고가 계산(모든 내부 숫자 중 최댓값)
    const allPrices = [];
    for (const inner of Object.values(priceDetailObj)) {
        for (const v of Object.values(inner)) {
            if (typeof v === 'number' && Number.isFinite(v)) allPrices.push(v);
        }
    }
    const maxPrice = allPrices.length ? Math.max(...allPrices) : 0;

    return {
        sellingProductName: data['판매상품이름'] || '',
        // 타입 비어있으면 기본값 (예전에 required라서 안전빵)
        sellingProductType: data['타입'] && String(data['타입']).trim() ? String(data['타입']).trim() : '기본',

        sellingProductContent: data['내용'] || '',
        sellingProductContentDetail: Array.isArray(data['세부내용'])
            ? data['세부내용'].join('\n')
            : data['세부내용'] || '',
        sellingProductContentDetailHTML: data['세부내용_raw_html'] || '',

        sellingProductImage: Array.isArray(data['사진']) ? data['사진'] : data['사진'] ? [data['사진']] : [],

        sellingProductPrice: maxPrice,
        // ⭐ 스키마가 Map< Map<number> >이므로 '객체의 2단계 중첩' 형태로 전달
        sellingProductPriceDetail: priceDetailObj,

        sellingProductPeriod: Array.isArray(data['여행기간'])
            ? parseInt(data['여행기간'][0], 10) || 0
            : parseInt(data['여행기간'], 10) || 0,

        sellingProductHour: parseDuration(data['소요시간']),

        sellingProductRating: parseFloat(data['별점']) || 0.0,
        sellingProductReviewCount: parseInt(data['리뷰'], 10) || 0,

        sellingProductCountry: Array.isArray(data['국가']) ? data['국가'][0] || '' : data['국가'] || '',
        sellingProductCountryList: Array.isArray(data['국가']) ? data['국가'] : data['국가'] ? [data['국가']] : [],

        sellingProductRegion: Array.isArray(data['지역']) ? data['지역'] : data['지역'] ? [data['지역']] : [],

        // 관광지 리스트는 key만 저장
        sellingProductPlaceList: placeList.length ? placeList : ['전체'],

        sellingProductCompany: data['출처'] || '',

        sellingProductLink: Array.isArray(data['링크']) ? data['링크'][0] || '' : data['링크'] || '',
        sellingProductLinkList: Array.isArray(data['링크']) ? data['링크'] : data['링크'] ? [data['링크']] : [],

        koreanGuide: data['한국어 가이드 유무'] || 'N',
    };
}
router.post('/json', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const rawData = req.body;

        if (!Array.isArray(rawData)) {
            return res.status(400).json({ error: 'JSON 배열을 보내주세요.' });
        }

        const transformed = rawData.map(transformDataToSellingProduct);

        const result = await SellingProduct.insertMany(transformed);

        res.status(201).json({ message: '저장 성공', count: result.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '서버 오류' });
    }
});
router.post('/jsonKKDAY', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const rawData = req.body;

        if (!Array.isArray(rawData)) {
            return res.status(400).json({ error: 'JSON 배열을 보내주세요.' });
        }

        const transformed = rawData.map(transformDataToSellingProductKKDAY);

        const result = await SellingProduct.insertMany(transformed);

        res.status(201).json({ message: '저장 성공', count: result.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '서버 오류' });
    }
});

// 괄호 확장 함수
function expandPlaceName(name) {
    const results = [name];
    const match = name.match(/(.+?)\s*\((.+?)\)/);
    if (match) {
        const outside = match[1].trim(); // 괄호 밖
        const inside = match[2].trim(); // 괄호 안
        results.push(outside, inside);
    }
    return [...new Set(results)];
}

async function extractPlacesFromSchedule(product, dbPlaces, placeEmbedding) {
    const rawResult = [];
    const normalizedResult = [];
    let extractPlaceSuccess = 0;
    let extractPlaceFail = 0;

    try {
        const scheduleList =
            product?.prod?.description_module?.PMDL_SCHEDULE?.content?.properties?.schedule_list?.list || [];

        for (const daily of scheduleList) {
            const dailySchedules = daily?.daily_schedule_list?.list || [];

            for (const item of dailySchedules) {
                const desc = item?.content?.desc || '';
                if (!desc) continue;

                const cleaned = cleanText(desc);
                if (isValidPlace(cleaned)) {
                    rawResult.push(cleaned);
                }
            }
        }
    } catch (err) {
        console.error('extractPlacesFromSchedule error:', err.message);
    }

    // 중복 제거
    const uniqueRaw = [...new Set(rawResult)];

    if (uniqueRaw.length == 0)
        return {
            extractedPlaces: [],
            normalizedPlaces: [],
        };

    // === DB 장소명 임베딩 목록 준비 ===
    // dbPlaces: [{ name: "서울타워"... }, ...]
    // placeEmbedding: dbPlaces의 임베딩 배열

    for (const rawPlace of uniqueRaw) {
        try {
            // 0) 괄호 확장 (ex: "에펠탑 (Eiffel Tower)" → ["에펠탑 (Eiffel Tower)", "에펠탑", "Eiffel Tower"])
            const expanded = expandPlaceName(rawPlace);

            let bestCandidate = null;
            let bestScore = -Infinity;

            for (const candidate of expanded) {
                // 1) candidate 임베딩 계산
                const [candidateEmbedding] = await embedText(candidate);

                // 2-1) 모든 점수 계산
                const scoredPlaces = await Promise.all(
                    dbPlaces.map(async (place, idx) => {
                        return { ...place, score: cosineSimilarity(candidateEmbedding, placeEmbedding[idx]) };
                    })
                );

                // 2-2) 가장 높은 점수 후보 찾기
                const topCandidate = scoredPlaces.sort((a, b) => b.score - a.score)[0];

                if (topCandidate.score > bestScore) {
                    bestScore = topCandidate.score;
                    bestCandidate = { candidate, match: topCandidate };
                }
            }

            // 3) LLM 최종 판별
            const prompt = `
            입력된 장소명: "${rawPlace}"
            후보 장소명: ${bestCandidate ? `"${bestCandidate.match.name}" (score: ${bestScore.toFixed(3)})` : '없음'}

            위 입력된 장소명과 후보가 같은 실제 관광지를 가리킨다면
            해당 후보의 이름만 정확히 반환하세요. 
            없으면 "NONE"이라고만 답변하세요.
            `;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
            });

            const answer = completion.choices[0].message.content.trim();

            if (answer !== 'NONE') {
                normalizedResult.push(answer);
                extractPlaceSuccess += 1;
            } else {
                extractPlaceFail += 1;
            }
        } catch (err) {
            console.log('매칭 실패:', rawPlace, err.message);
        }
    }

    console.log('extractPlaceSuccess');
    console.log([...new Set(normalizedResult)]);
    console.log(extractPlaceSuccess);
    console.log(extractPlaceFail);

    // 최종 결과 반환: 원본과 DB 정규화 버전 모두
    return {
        extractedPlaces: uniqueRaw,
        normalizedPlaces: [...new Set(normalizedResult)],
    };
}

// 불필요 단어/패턴 제거
function cleanText(text) {
    return text
        .replace(/\(.*?\)/g, '') // 괄호 안 제거
        .replace(/※.*/g, '') // 주석 제거
        .replace(/\d{1,2}[:시분]\d{0,2}/g, '') // 시간 제거
        .replace(/\d{4}년.*$/, '') // 연도/기간 제거
        .replace(/집합|출발|점심|석식|조식|개별|자유시간|간판|정시/g, '') // 불필요 키워드
        .replace(/\s+/g, ' ') // 공백 정리
        .trim();
}

// 실제 관광지로 판단할 수 있는 조건
function isValidPlace(text) {
    if (!text) return false;
    if (text.length < 2) return false;
    // 너무 일반적인 문구 제외
    const stopWords = ['출발일', '여행', '자유', '식사', '미정', '포함', 'KKday'];
    return !stopWords.some((w) => text.includes(w));
}

// ======================
// KKday 전체 상품 캐시 갱신 함수
// ======================
async function updateProductCache() {
    try {
        // TODO - 조회할 국가 리스트 (국가명 or 국가코드 둘 다 가능)
        const targetCountries = ['한국', '일본', '중국', '베트남', '태국', '필리핀', '싱가포르', '홍콩과 마카오'];
        const dbCountries = ['Korea', 'Japan', 'China', 'Vietnam', 'Thailand', 'Philippines', 'Singapore', 'China'];
        // const targetCountries = ['A01-004', 'A01-018']; // 코드로 지정해도 OK

        let allProducts = [];
        let country_codes = [];

        const countryData = await kkdayGet('Common/QueryCountryInfo', { locale: 'ko' });

        for (let i = 0; i < targetCountries.length; i++) {
            const { country_code, city_code, error } = findKKdayCode(countryData, {
                countryInput: targetCountries[i],
            });

            if (error) {
                console.error('countryData error');
                console.error(error);
                continue;
            }

            country_codes.push(country_code);
        }

        // 기존 캐시 로딩
        let existingCache = [];
        try {
            existingCache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
        } catch (e) {
            existingCache = [];
        }
        const existingCacheMap = new Map(existingCache.map((p) => [p.prod_name, p]));

        let page = 0;
        const pageSize = 50;

        console.time('db_load_time');
        // DB에서 placeEmbedding의 장소 name(place) + embedding 가져오기
        const dbPlaces = await fetchPlaces();
        //const dbNames = dbPlaces.map((p) => p.name);
        console.timeEnd('db_load_time');

        for (let i = 0; i < targetCountries.length; i++) {
            const dbPlacesFiltered = dbPlaces.filter((p) => p.country === dbCountries[i]);
            const dbNamesFiltered = dbPlacesFiltered.map((p) => p.name);

            console.time('db_embed_time');
            const placeEmbeddingFiltered = await embedText(dbNamesFiltered);
            console.timeEnd('db_embed_time');

            while (true) {
                const response = await kkdayPost('Search', {
                    country_keys: [country_codes[i]],
                    page_size: pageSize,
                    start: page * pageSize,
                    locale: 'ko',
                });

                if (!response.prods || response.prods.length === 0) break;

                //if (page > 2) break; // TODO - 본서버 적용때는 주석처리!!!

                const newProducts = response.prods
                    // 먼저 국가 2개 이상인 상품은 아예 제외
                    .filter((p) => !p.countries || p.countries.length <= 1)
                    .map((p) => {
                        const cached = existingCacheMap.get(p.prod_no);

                        const alwaysUpdate = {
                            b2c_price: p.b2c_price,
                            b2b_price: p.b2b_price,
                            order_count: p.order_count,
                            rating_count: p.rating_count,
                            avg_rating_star: p.avg_rating_star,
                            earliest_sale_date: p.earliest_sale_date,
                        };

                        const needLLM =
                            !cached || cached.prod_name !== p.prod_name || cached.introduction !== p.introduction;

                        return needLLM
                            ? { ...p, ...alwaysUpdate, needLLM: true }
                            : { ...cached, ...alwaysUpdate, needLLM: false };
                    });

                const processedProducts = await asyncPool(3, newProducts, async (product) => {
                    if (!product.needLLM) return product;

                    // 세부 정보 조회 (상품 스케줄 포함)
                    let fullProduct;
                    try {
                        fullProduct = await kkdayPost('/Product/QueryProduct', {
                            prod_no: product.prod_no,
                            locale: 'ko',
                        });
                    } catch (err) {
                        console.error(`[ERROR] QueryProduct 실패: ${product.prod_no}`, err.message);
                        fullProduct = null;
                    }

                    // 관광지 배열 뽑기
                    const { extractedPlaces, normalizedPlaces } = await extractPlacesFromSchedule(
                        fullProduct,
                        dbPlacesFiltered,
                        placeEmbeddingFiltered
                    );

                    // sellingProductPlaceList가 있으면 추가 병합
                    const productPlaces = [...(product.sellingProductPlaceList || []), ...extractedPlaces];

                    const isNationwide = await isNationwideProduct(product);

                    // 성향 점수 계산
                    const productText = [product.prod_name, product.introduction || '', ...productPlaces].join(', ');
                    const tendencyPrompt = `
                    상품 정보: ${productText}
                    다음 성향 목록: ${tendencyData.flat().join(', ')}
                    각 성향이 이 상품과 얼마나 잘 맞는지 0~1 사이 점수로 JSON 객체로 반환해주세요.
                    반드시 전체 성향 목록이 포함되어야 하고, 누락된 값이 없도록:
                    {"힐링":0.9, "사진 명소":0.1, ...}
                    숫자는 소수점 한자리까지 가능.
                    `;

                    let tendencyScores = {};
                    try {
                        const completion = await openai.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'user', content: tendencyPrompt }],
                            max_tokens: 400,
                        });

                        const text = completion.choices[0].message.content;
                        const jsonMatch = text.match(/\{.*\}/s);
                        tendencyScores = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
                    } catch (e) {
                        tendencyScores = Object.fromEntries(tendencyData.flat().map((t) => [t, 0]));
                    }

                    let productEmbedding = [];

                    // 상품 텍스트 기반 임베딩 계산
                    if (productPlaces.length > 0) {
                        const normProduct = productPlaces.map((pl) => normalizePlaceName(pl));
                        productEmbedding = await embedText(normProduct.join(', '));
                    }

                    return {
                        ...product,
                        isNationwide,
                        tendencyScores,
                        productEmbedding,
                        productPlaces,
                        normalizedPlaces,
                        ...product.alwaysUpdate,
                    };
                });

                allProducts.push(...processedProducts);
                page++;
                console.log(`[CACHE] 상품 수집 완료 (누적: ${allProducts.length})`);
            }
        }

        // 끝나고 한 번에 넣어서 끊기지 않게!
        productCache = allProducts;

        // JSON 파일로 저장
        await fs.writeFile(CACHE_FILE, JSON.stringify(productCache, null, 2));
        console.log(`[CACHE] KKday 상품 캐시 갱신 완료 (총 ${productCache.length}개)`);
    } catch (error) {
        console.error('[CACHE] 상품 캐시 갱신 실패:', error);
    }
}

// ======================
// 서버 시작 시 캐시 초기화
// ======================
(async () => {
    try {
        const productData = await fs.readFile(CACHE_FILE, 'utf-8');
        productCache = JSON.parse(productData);
        console.log(`[CACHE] 캐시 파일 로딩 완료 (${productCache.length}개)`);
    } catch {
        console.log('[CACHE] 캐시 파일 없음, 최초 전체 상품 조회 시작...');
        await updateProductCache();
    }
})();

// ======================
// 하루 1회 새벽 3시에 갱신 (cron: "0 3 * * *")
// ======================
cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] KKday 상품 캐시 갱신 시작...');
    await updateProductCache();
});

module.exports = router;
