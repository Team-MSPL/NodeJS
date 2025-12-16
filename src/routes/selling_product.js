const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SellingProduct = require('../schemas/selling_product.js');
const placeEmbedding = require('../schemas/place_embedding.js');
const User = require('../schemas/user.js');
var { fetchPlaces } = require('./firebase/firebase_place_embedding.js');
const { RegionMap, KKDAYMap } = require('./region_mapping/region_mapping.js');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const axios = require('axios');
var _ = require('lodash');
const fuzz = require('fuzzball');
const fsp = require('fs').promises;

const fs = require('fs');
const cron = require('node-cron');
const admin = require('firebase-admin');
const CACHE_FILE = '/home/ubuntu/danim_database/kkday_products_cache.json';
const CACHE_FILE2 = '/home/ubuntu/danim_database/place_cache.json';
const OpenAI = require('openai');
const csvParser = require('csv-parser');

const KKDAY_BASE_URL = 'https://api-b2d.kkday.com/v4';
const KKDAY_API_KEY = process.env.KKDAY_API_KEY;

// === 캐시 로드 ===
let productCache = [];

const tendencyData = [
    ['나홀로', '연인과', '친구와', '가족과', '효도', '자녀와', '반려동물과'],
    ['힐링', '활동적인', '배움이 있는', '맛있는', '교통이 편한', '알뜰한'],
    ['레저 스포츠', '산책', '드라이브', '이색체험', '쇼핑', '시티투어'],
    ['바다', '산', '실내여행지', '문화시설', '사진 명소', '유적지', '박물관', '전통', '공원', '사찰', '성지'],
    ['봄', '여름', '가을', '겨울'],
];

router.get('/list', async (req, res) => {
    return res.status(200).json({
        results: [],
    });
});
// // 핑퐁
// router.get('/ping', async (req, res) => {
//     res.status(200).json({ message: 'Pong!' });
// });

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

async function safeEmbedText(texts) {
    if (!Array.isArray(texts)) texts = [texts];

    // 빈 문자열 제거
    const filteredTexts = texts.filter((t) => typeof t === 'string' && t.trim() !== '');

    const BATCH_SIZE = 50;
    const embeddings = [];

    for (let i = 0; i < filteredTexts.length; i += BATCH_SIZE) {
        const batch = filteredTexts.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;

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
    // if (/(공항\s?(픽업|샌딩|라운지))/i.test(product.prod_name + product.introduction)) {
    //     return true; // 강제 1
    // }

    const prompt = `
    상품명: ${product.prod_name}
    상품 설명: ${product.introduction || ''}
    
    질문: 이 상품은 
    1) 특정 도시/명소에 한정된 상품인지, 
    2) 특정 지역(예: 하노이, 오사카, 제주도) 전역에서 쓸 수 있는 상품인지, 
    3) 한 나라 전역에서 쓸 수 있는 상품인지 구분하세요.
    
    판단 기준:
    - 1 (전국/지역 전역용): 
      * 한 나라 전체에서 사용 가능한 상품 (예: JR Pass, eSIM, 전국 교통 패스, 전국 체인 이용권, 통신 요금제)
      * 특정 지역 전역(예: 하노이 전역, 오사카 전역, 제주도 전역)에서 사용 가능한 상품 
        (예: **지역 공항 픽업/샌딩 서비스, 지역 공항 라운지 이용권, 공항-시내 이동 서비스, 지역 전체 숙박/투어 이용권 등**)
        * 지역 내 어느 장소든 상관없이 이용 가능한 출장 서비스: 1
        * 특히 '공항 픽업', '공항 샌딩', '공항 라운지'등 공항 관련 서비스가 포함된 경우는 지역 전역용(1)으로 간주하세요.
        * 공항/역/터미널 <-> 공항/역/터미널/원하는 장소 간 이동 서비스는 1
        * 특히 '전세 차량', '차량 대절', '프라이빗', '픽업', '지하철 패스' 등 지역 내를 자유롭게(오직 미리 정해진 코스대로만 갈 수 있는 상품 제외) 돌아다닐 수 있게 도와주는 교통 관련 서비스가 포함된 경우는 지역 전역용(1)으로 간주하세요.
        * 렌터카, 전세 차량: 1
    
    - 0 (장소 한정용): 
      * 특정 관광지/테마파크/건물 내부에서만 사용 가능한 상품 
        (예: 디즈니랜드 티켓, 특정 사원 입장권, 특정 공연 입장권)
      * 특정 장소들을 투어하는 고정된 코스를 가진 투어 상품도 포함 ( 자유 투어는 지역 전역용(1)로 판단 )
        * 공항/역/터미널 <-> 공항/역/터미널 외 장소 (관광지 제외)는 0
        * 자전거 대여, 오토바이 대여: 0
    
    출력 형식:
    - 정답은 반드시 숫자 0 또는 1만 출력하세요.
    - 불필요한 설명을 붙이지 마세요.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1,
        });
        return completion.choices[0].message.content.trim() === '1';
    } catch {
        return false;
    }
}

async function isTravelerOnlyProduct(product) {
    const text = `${product.prod_name || ''}\n${product.introduction || ''}`.toLowerCase();

    const strongPositive = [
        'e-sim',
        'esim',
        '유심',
        '유심칩',
        '심카드',
        '심 카드',
        '데이터 유심',
        '데이터심',
        '데이터 esim',
        '포켓 와이파이',
        '포켓와이파이',
        '포켓wifi',
        '포켓 wi-fi',
        '로밍',
        'roaming',
    ];

    const weakPositive = ['공항', 'pick-up', '픽업', '드롭', '환전', '수령', 'qr', 'qr코드', 'qr 코드'];

    const strongNegative = [
        '국내',
        '내국인',
        '한국 내',
        '한국 여행',
        '국내 여행',
        '한국인 전용',
        '지역민',
        '지역 주민',
        '내국인 전용',
    ];

    // hit count
    const hit = (list) => list.filter((k) => text.includes(k)).length;

    const strongPosHit = hit(strongPositive);
    const weakPosHit = hit(weakPositive);
    const strongNegHit = hit(strongNegative);

    // ② eSIM 등 → 확실히 여행자 전용
    if (strongPosHit > 0) return true;

    // ③ eSIM + 한국 언급 → 외국인 입국용으로 간주
    if (strongPosHit > 0 && text.includes('한국')) return true;

    // // ① 국내 단어가 강하게 있으면 무조건 국내용
    // if (strongNegHit > 0) return false;

    // ④ 약한 키워드만 있을 경우 (공항, QR 등)
    if (weakPosHit > 0) {
        // 모호할 경우 모델에 위임
        const prompt = `
      다음 상품을 보고 "해외 여행자 전용 상품"인지 판단하세요.
      출력은 반드시 숫자 0 또는 1만 하십시오. (0 = 일반 상품, 1 = 여행자 전용)
      
      예시:
      상품명: "일본 데이터 eSIM 7일 무제한"
      상품 설명: "입국 즉시 QR 스캔으로 활성화되는 일본 eSIM"
      정답: 1
      
      상품명: "서울 강남 호텔 1박 조식 포함"
      상품 설명: "강남 중심의 비즈니스 호텔"
      정답: 0
      
      상품명: "한국 방문자용 선불 유심 카드 (공항 수령)"
      상품 설명: "공항에서 수령 가능한 선불 유심, 단기 여행자용"
      정답: 1
      
      상품명: "제주 여미지 식물원 입장권"
      상품 설명: "지금 바로 여미지식물원 할인 입장권을 예약하세요!"
      정답: 0
      
      상품명: "경복궁 창덕궁 한복대여 | 공주한복"
      상품 설명: "공주한복에는요즘 유행하고 있는 고급스럽고 단아한 한복까지 다양하게 준비되어 있습니다."
      정답: 0
      
      상품명: "제주 차귀도 달래 배낚시(사전예약 필수)"
      상품 설명: "차귀도의 해안절경을 만끽하며 짜릿한 손맛과 함께하는 즐거움을 누려보세요!"
      정답: 0
      
      상품명: "${product.prod_name.replace(/\n/g, ' ')}"
      상품 설명: "${(product.introduction || '').replace(/\n/g, ' ')}"
      
      정답:
        `.trim();

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4.1-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 3,
                temperature: 0.0,
            });

            const raw = (completion.choices?.[0]?.message?.content || '').trim();
            const onlyDigits = raw.match(/[01]/)?.[0];
            return onlyDigits === '1';
        } catch (err) {
            console.error('isTravelerOnlyProduct - model error:', err);
            return false;
        }
    }

    // ⑤ 아무 관련 키워드가 없으면 일반 상품
    return false;
}

// 기존 llmMatch (단일 도시)
async function llmMatch(city, kkdayCities) {
    const prompt = `
    도시명 "${city}"을(를) 아래 KKday 도시 목록 중 가장 가까운 이름 하나로 매핑해줘.
    KKday 도시 목록: [${kkdayCities.join(', ')}]
    반드시 이름 하나만 반환하며 다른 내용은 반환하면 안돼.
    없다면 "null"이라고 답해.
    예시 출력: "마닐라"
    `;

    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
        });
        const answer = res.choices[0].message.content.trim();
        return answer === 'null' ? null : answer;
    } catch (err) {
        console.error('LLM 매칭 실패:', err.message);
        return null;
    }
}

// 🔹 batch 매핑용
async function llmBatchMatch(cityList, kkdayCities) {
    const prompt = `
    다음 도시들을 KKday 도시 목록에 매핑해줘.
    입력 도시 목록: [${cityList.join(', ')}]
    KKday 도시 목록: [${kkdayCities.join(', ')}]
    각 입력 도시를 KKday 도시 또는 "null"로 매핑해서 JSON 배열로만 반환해.
    반드시 JSON 배열로만 반환하며 다른 내용은 반환하면 안돼.
    예시 출력: ["마닐라", "세부", "null"]
    `;

    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
        });
        const answer = res.choices[0].message.content.trim();
        return JSON.parse(answer); // ["마닐라", "세부", "null"] 같은 결과 기대
    } catch (err) {
        console.error('LLM 배치 매칭 실패:', err.message);
        return cityList.map(() => null); // 실패 시 전부 null
    }
}

async function normalizeCities(country, cityList) {
    const filteredCityList = cityList.filter((city) => city !== '홍콩' && city !== '마카오');

    const map = RegionMap[country];
    const kkdayPool = KKDAYMap[country] || [];
    if (!map) return [];

    let normalized = [];

    if (filteredCityList.length <= 5) {
        // 개별 매칭 (안정성 우선)
        for (const city of filteredCityList) {
            let val = map[city];
            if (val) {
                if (Array.isArray(val)) normalized.push(...val);
                else normalized.push(val);
            } else {
                const llm = await llmMatch(city, kkdayPool);
                console.log('llmResults');
                console.log(llm);
                if (llm) {
                    normalized.push(llm);
                }
            }
            continue; // null 또는 undefined → 매칭 제외
        }
    } else {
        // 배치 매칭 (성능 우선)
        const unmapped = [];
        const directMapped = [];

        for (const city of filteredCityList) {
            const val = map[city];
            if (val) {
                if (Array.isArray(val)) directMapped.push(...val);
                else directMapped.push(val);
            } else {
                unmapped.push(city);
            }
        }

        const batchResults = await llmBatchMatch(unmapped, kkdayPool);

        console.log('batchResults');
        console.log(batchResults);

        batchResults.forEach((res, idx) => {
            if (res && res !== 'null') {
                directMapped.push(res);
            }
            // null 또는 undefined → 매칭 제외
        });

        normalized.push(...directMapped);
    }

    if (cityList.includes('홍콩')) {
        normalized.push('홍콩');
    }
    if (cityList.includes('마카오')) {
        normalized.push('마카오');
    }

    // TODO - 매칭 안되는 도시들이 많을 경우 이 함수 안에서 "모든 도시"를 넣어볼 것! + 위에서 매칭 안되어도 넘기는 대신 모든 도시로 해버리기?
    // if (normalized.length == 0) {
    //     normalized.push('모든 도시');
    // }

    normalized = normalized.filter((city) => city !== '모든 도시');

    // 중복 제거
    return [...new Set(normalized)];
}

// router.post('/update', async (req, res) => {
//     const csvFile = '/home/ubuntu/danim_database/isNationwide.csv';
//     const updates = [];

//     fs.createReadStream(csvFile)
//         .pipe(csvParser())
//         .on('data', (row) => {
//             // row._id, row.isNationwide 활용
//             updates.push({
//                 _id: row._id,
//                 isNationwide: row.isNationwide.trim() === 'TRUE', // TRUE/FALSE 문자열 -> Boolean
//             });
//         })
//         .on('end', async () => {
//             console.log('CSV 읽기 완료', updates.length);

//             const bulkOps = updates.map((item) => ({
//                 updateOne: {
//                     filter: { _id: new mongoose.Types.ObjectId(item._id.trim()) },
//                     update: { $set: { isNationwide: item.isNationwide } },
//                 },
//             }));

//             try {
//                 const result = await SellingProduct.bulkWrite(bulkOps);
//                 console.log('bulkWrite 완료:', result.modifiedCount, '개 문서 수정됨');
//             } catch (err) {
//                 console.error('bulkWrite 오류:', err);
//             }
//         });
// });

// 판매 상품 목록 추천받기 ( 5개씩 )
// 프론트에서 다이어로그를 띄우기 전에 먼저 이 API를 쏘고, 결과가 있으면 띄움 ( AI 실행 로딩 때 같이 쏘면 될듯 )
router.post('/recommend', async (req, res) => {
    try {
        const {
            pathList,
            country,
            cityList,
            selectList,
            topK = 10,
            mode = 'recommend', // 추천/목록 모드 구분
            sortOption = 'order_count', // order_count, b2b_price, avg_rating_star, b2c_price
            sortOrder = 'desc', // asc, desc
            keyword = '', // prod_name 검색
            page = 1, // 페이지 번호
            limit = 20, // 페이지당 개수
        } = req.body;

        let selectedTendencies = [];

        //selectList에서 선택된 항목들만 tendencyData 텍스트로 꺼내 하나의 배열로 만들기
        if (selectList) {
            console.log(selectList);
            selectedTendencies = tendencyData.flatMap((row, i) => {
                const selRow = Array.isArray(selectList[i]) ? selectList[i] : [];
                return row.filter((val, j) => selRow[j] === 1);
            });

            //console.log(selectedTendencies);
        }

        // TODO - 느릴 경우 MongoDB Atlas Vector Search로 진행

        // // 1. 국가/도시 필터링
        // let filteredProducts = productCache.filter((p) => p.countries.some((c) => c.name === country));
        // // cities 배열 중에 cityList에 포함된 게 하나라도 있으면 통과
        // if (cityList && cityList.length > 0 && !cityList.includes('전체')) {
        //     filteredProducts = filteredProducts.filter((product) =>
        //         product.countries.some((country) =>
        //             country.cities.some((city) => city.name === '모든 도시' || cityList.includes(city.name))
        //         )
        //     );
        // }

        // 1. MongoDB에서 상품 불러오기 (필터링 가능)
        let mongoFilter = { isActive: { $ne: false } }; // 기본적으로 활성화된 상품만 불러오기
        if (country) {
            mongoFilter['countries'] = country;
        }
        // 🇰🇷 한국일 경우: isTravelerOnly 상품 제외
        if (['대한민국', '한국', 'KOR', 'KR', 'Korea'].includes(country)) {
            mongoFilter['isTravelerOnly'] = { $ne: true };
        }

        // cityList 정규화
        // TODO - 매칭 안되는 도시들이 많을 경우 이 함수 안에서 "모든 도시"를 넣어볼 것!
        let normalizedCities = [];
        if (cityList) {
            const resultCityList = cityList.map((item) => {
                const parts = item.split('/');
                return parts.pop(); // 맨 뒤 값만
            });
            normalizedCities = await normalizeCities(country, resultCityList);
        }

        if (normalizedCities && normalizedCities.length > 0) {
            mongoFilter['$or'] = [
                { cities: { $in: normalizedCities } }, // cityList에 있는 도시가 하나라도 포함
                { cities: ['모든 도시'] }, // cities 배열이 정확히 ["모든 도시"]인 경우
            ];
        }
        if (mode === 'list') {
            // prod_name 검색 적용
            if (keyword && keyword.trim() !== '') {
                mongoFilter['prod_name'] = { $regex: keyword.trim(), $options: 'i' };
            }

            // 정렬 기준 매핑
            const fieldMap = {
                order_count: 'order_count',
                b2b_price: 'b2b_price',
                b2c_price: 'b2c_price',
                avg_rating_star: 'avg_rating_star',
            };

            const sortField = fieldMap[sortOption] || fieldMap['order_count'];
            const sortDirection = sortOrder === 'asc' ? 1 : -1;

            const sortQuery = { [sortField]: sortDirection };

            // 전체 개수 먼저 계산
            const totalCount = await SellingProduct.countDocuments(mongoFilter);

            // 페이지 계산
            const skip = (page - 1) * limit;

            // 실제 데이터 조회
            const products = await SellingProduct.find(mongoFilter).skip(skip).limit(limit).sort(sortQuery).lean();

            return res.json({
                page,
                limit,
                totalCount,
                totalPage: Math.ceil(totalCount / limit),
                sortOption,
                products: products.map(({ embedding, ...rest }) => rest),
            });
        }
        // MODE = "recommend": 기존 추천 로직 실행
        else {
            //console.time('product_load_time');
            let filteredProducts = await SellingProduct.find(mongoFilter).lean();
            //console.timeEnd('product_load_time');

            // 전국용 상품 따로 빼두고 나중에 추가
            // 공항 픽업, 샌딩 등 상품도 포함! - 어차피 앞에서 지역으로 한 번 거른 상품들이라서 괜찮음
            const nationwideProducts = filteredProducts.filter((p) => p.isNationwide);

            filteredProducts = filteredProducts.filter((p) => !p.isNationwide);

            console.log('filteredProducts.length');
            console.log(filteredProducts.length);

            let recommendProducts = [];

            for (const path of pathList) {
                //console.time('duration_time');

                const pathFlat = flattenPath(path);

                // // 코스 장소 임베딩 미리 한번에 가져오기 - 어차피 코스는 다 같음
                // const placeMap = await getPlaceEmbeddingsBulk(pathFlat);

                // const placeEmbeddings = pathFlat.map((p) => placeMap[p]).filter(Boolean);
                // if (!placeEmbeddings.length) return 0;

                // is_essential or p.category === 5 인 경우만 임베딩으로 추가 가중치
                // // TODO - API 실행 시간이 여유있다면 category가 0이 아닌 경우로 바꾸기?
                const essentialPlaces = path
                    .flatMap((day) => day.filter((p) => p.is_essential || (p.category && p.category !== 0)))
                    .map((p) => p.name);

                // essential 비율 계산
                const essentialRatio = essentialPlaces.length / pathFlat.length; // 0 ~ 1

                // essential 제외한 non-essential 장소들만 추출
                const nonEssentialPlaces = pathFlat.filter((p) => !essentialPlaces.includes(p));

                // essential 장소들에 대해 임베딩 직접 계산
                const essentialEmbeddings = await embedText(essentialPlaces);

                // 1. 캐싱된 normalizedPlaces를 활용한 빠른 매칭
                let results = await asyncPool(5, filteredProducts, async (product) => {
                    try {
                        // pathFlat vs product.normalizedPlaces 매칭 (non-essential만)
                        const commonPlaces = nonEssentialPlaces.filter((place) =>
                            product.normalizedPlaces?.includes(place)
                        );

                        let nameMatchScore = 0;
                        if (commonPlaces.length > 0) {
                            //nameMatchScore = commonPlaces.length / nonEssentialPlaces.length; // 단순 비율
                            nameMatchScore = commonPlaces.length / product.normalizedPlaces?.length; // 단순 비율
                        }

                        // console.log('nameMatchScore');
                        // console.log(nameMatchScore);

                        let vectorScoreCourse = nameMatchScore;

                        if (essentialPlaces.length > 0) {
                            const validEmbeddings = essentialEmbeddings.filter(Boolean);

                            if (validEmbeddings.length > 0) {
                                const scores = validEmbeddings.map((emb) => cosineSimilarity(emb, product.embedding));
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

                        // console.log(product.prod_name);
                        // console.log(vectorScoreCourse);

                        return { ...product, vectorScoreCourse, avgPrefScore };
                    } catch (err) {
                        console.error('추천 계산 중 오류', err);
                        return { ...product, vectorScoreCourse: 0, avgPrefScore: 0 };
                    }
                });

                //console.timeEnd('duration_time');

                // 2. 벡터, 성향 점수 배열
                const vectorScores = results.map((p) => p.vectorScoreCourse);
                const prefScores = results.map((p) => p.avgPrefScore);

                // 3. minMax 스케일링
                const normVectorScores = minMaxScale(vectorScores);
                const normPrefScores = minMaxScale(prefScores);

                // 4. finalScore 계산 (임계값 반영)
                const VECTOR_THRESHOLD = 0.4; // 코사인 유사도 최소 기준

                let passed = [];
                let fallback = [];

                results.forEach((p, idx) => {
                    const rawVector = vectorScores[idx];
                    const normVector = normVectorScores[idx];
                    const normPref = normPrefScores[idx];

                    const vectorCombined = rawVector * 0.6 + normVector * 0.4;
                    const prefCombined = normPref;
                    const finalScore = vectorCombined * 0.7 + prefCombined * 0.3;

                    // 점수 저장
                    p.finalScore = finalScore;

                    if (rawVector >= VECTOR_THRESHOLD) {
                        passed.push(p); // 정상 통과
                    } else if (rawVector >= VECTOR_THRESHOLD / 2) {
                        fallback.push(p); // fallback 후보
                    }
                    // TODO - 지역 필터링이 잘 된다면, 임계값 미달이더라도 그냥 넣어도 될듯. 해당 지역의 다른 관광지 추천할겸?
                });

                // 5. 점수 순 정렬
                passed.sort((a, b) => b.finalScore - a.finalScore);
                fallback.sort((a, b) => b.finalScore - a.finalScore);

                // fallback 조건 적용
                results = passed.length > 0 ? passed : fallback;

                nationwideProducts.sort((a, b) => {
                    const aCount = a?.sellingProductReviewCount || 0;
                    const bCount = b?.sellingProductReviewCount || 0;
                    return bCount - aCount; // 내림차순
                });

                // 전국용 상품 - 카테고리별 최대 1개씩 선택
                const uniqueNationwide = [];
                const seenCategories = new Set();

                for (const product of nationwideProducts) {
                    const category = product.product_category_main || '기타';
                    if (!seenCategories.has(category)) {
                        uniqueNationwide.push(product);
                        seenCategories.add(category);
                    }
                    if (uniqueNationwide.length >= 5) break; // 최대 5개까지만 추천
                }

                // topK + 전국용 상품 추가
                let topResults = results.slice(0, topK).concat(uniqueNationwide);
                // // topK + 전국용 상품 추가
                // let topResults = results.slice(0, topK).concat(nationwideProducts.slice(0, 5));

                // embedding 제거
                recommendProducts.push(topResults.map(({ embedding, ...rest }) => rest));
            }
            res.json(recommendProducts);
        }
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
        // SellingProduct.findOne({ _id: id })
        //     .then(async (sellingProduct) => {
        //         if (!sellingProduct) {
        //             return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
        //         }

        //         res.status(200).json(sellingProduct);
        //     })
        //     .catch((error) => {
        //         console.error('SellingProduct.findOne() 함수에 문제 발생 : ', error);
        //         res.status(403).json({ message: '잘못된 sellingProductId 입니다.' });
        //     });
    } catch (error) {
        console.error('/sellingProduct/:id - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. 판매 상품 링크 클릭 로그 저장하기
router.patch('/linkClickLog', async (req, res) => {
    try {
        const { sellingProductId, clickLog } = req.body;

        // //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        // SellingProduct.findOne({ _id: sellingProductId })
        //     .then(async (sellingProduct) => {
        //         if (!sellingProduct) {
        //             return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
        //         }

        //         sellingProduct.sellingProductLinkClickLog.push(clickLog);

        //         await sellingProduct.save();

        //         res.status(200).json({ message: '판매 상품 링크 클릭 로그 저장 완료.' });
        //     })
        //     .catch((error) => {
        //         console.error('SellingProduct.findOne() 함수에 문제 발생 : ', error);
        //         res.status(403).json({ message: '잘못된 sellingProductId 입니다.' });
        //     });
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

    if (uniqueRaw.length === 0) {
        // product.prod 안전 체크
        if (product && product.prod) {
            if (product.prod.prod_name) uniqueRaw.push(product.prod.prod_name);
            if (product.prod.introduction) uniqueRaw.push(product.prod.introduction);
        } else {
            console.log('[CACHE][WARN] product.prod is undefined', {
                productId: product?.id || product?.prod_id || 'unknown',
                product: product,
            });
            /*
            product: {
                result: '02',
                result_msg: "MISSING_FIELD:These Product type can't support API. Please Go website to Order It."
            }
            위 경우에는 아예 몽고db에 저장도 안하게 외부에서 처리
            */
        }
    }

    if (uniqueRaw.length == 0)
        // 그래도 없으면 리턴
        return {
            extractedPlaces: [],
            normalizedPlaces: [],
        };

    // === [1] 모든 rawPlace 후보 확장 ===
    const expandedMap = {}; // rawPlace → expanded list
    const expandedAll = []; // 전체 후보 모음
    for (const rawPlace of uniqueRaw) {
        const expanded = expandPlaceName(rawPlace);
        expandedMap[rawPlace] = expanded;
        expandedAll.push(...expanded);
    }

    // === [2] 임베딩 배치 요청 ===
    let embeddingResp;
    try {
        embeddingResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: expandedAll,
        });
    } catch (err) {
        console.error('Embedding 요청 실패!', err.message);
        console.error('요청 객체 : ', expandedAll);

        return {
            extractedPlaces: uniqueRaw,
            normalizedPlaces: [],
        };
    }

    const embeddingMap = {};
    embeddingResp.data.forEach((item, idx) => {
        embeddingMap[expandedAll[idx]] = item.embedding;
    });

    // === [3] rawPlace별 top5 후보 계산 ===
    const matchCandidates = [];
    for (const rawPlace of uniqueRaw) {
        const expanded = expandedMap[rawPlace];

        let bestCandidates = [];

        for (const candidate of expanded) {
            const candidateEmbedding = embeddingMap[candidate];

            const scoredPlaces = dbPlaces.map((place, idx) => ({
                ...place,
                score: cosineSimilarity(candidateEmbedding, placeEmbedding[idx]),
            }));

            // 상위 5개 후보 추출
            const topCandidates = scoredPlaces
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((p) => ({
                    candidate,
                    match: p,
                    score: p.score,
                }));

            bestCandidates.push(...topCandidates);
        }

        // score 기준 상위 5개만 유지
        bestCandidates = bestCandidates.sort((a, b) => b.score - a.score).slice(0, 5);

        matchCandidates.push({ raw: rawPlace, candidates: bestCandidates });
    }

    const prompt = `
    다음은 입력된 장소명과 상위 후보 매칭 점수입니다.
    각 입력마다 최대 5개 후보가 있습니다.

    규칙:
    - 각 입력(rawPlace)에 대해 "가장 일치하는 후보의 이름"만 출력
    - 후보 중 동일한 관광지가 없으면 "NONE"
    - 반드시 JSON 배열 형식으로 출력
    - 다른 설명, 코드블록, 텍스트 절대 포함 금지

    예시 출력: ["서울타워","NONE","에펠탑"]

    입력 목록:
    ${matchCandidates
        .map(
            (p) =>
                `- ${p.raw}:\n${p.candidates
                    .map((c, i) => `   [${i + 1}] ${c.match.name} (score: ${c.score.toFixed(2)})`)
                    .join('\n')}`
        )
        .join('\n')}
    `;

    let answers = [];
    let rawAnswer = '';
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
                { role: 'system', content: '당신은 JSON 출력 전용 엔진입니다. 반드시 JSON 배열만 출력하세요.' },
                { role: 'user', content: prompt },
            ],
            max_completion_tokens: 10000,
        });

        rawAnswer = completion.choices[0].message.content.trim() || '';
        // console.log('=== RAW ANSWER ===');
        // console.log(rawAnswer);

        // 백틱/코드블록 제거
        rawAnswer = rawAnswer
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();

        if (!rawAnswer) {
            console.warn('⚠️ 모델이 빈 응답을 반환했습니다.');
        }

        answers = JSON.parse(rawAnswer);
    } catch (err) {
        console.error('LLM 판별 실패 (파싱 오류):', err.message);
        console.error('원본 응답:', rawAnswer);
        // fallback: NONE으로 채우기
        answers = matchCandidates.map(() => 'NONE');
    }

    // === [5] 결과 집계 ===
    answers.forEach((ans, idx) => {
        if (ans !== 'NONE') {
            normalizedResult.push(ans);
            extractPlaceSuccess += 1;
        } else {
            extractPlaceFail += 1;
        }
    });

    console.log(product.prod.prod_name);
    console.log('extractPlaceSuccess : ', extractPlaceSuccess, ' / ', extractPlaceFail);
    console.log([...new Set(normalizedResult)]);

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

async function kkdayPostWithRetry(path, body, retries = 3, delayMs = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await kkdayPost(path, body);
            return response; // 성공하면 바로 반환
        } catch (err) {
            if (err.response?.status === 529 && attempt < retries) {
                console.log(`[WARN] ${path} 실패(${err.message}), ${delayMs}ms 후 재시도 ${attempt}/${retries}`);
                await new Promise((r) => setTimeout(r, delayMs));
                delayMs *= 2; // 지수적 backoff
            } else {
                console.error(`[ERROR] ${path} 실패: ${err.message}`);
                throw err; // 더 이상 재시도 불가 시 에러 던짐
            }
        }
    }
}

function containsKorean(text) {
    if (!text) return false;
    return /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
}

let isUpdating = false;

// 판매 제한(민원 우려) 상품 키워드 리스트
const restrictedKeywords = ['회원권', '선불권', '분양', '지분', '충전금'];
//  '쿠폰', '포인트',
function isRestrictedProduct(product) {
    const text = `${product.prod_name || ''} ${product.introduction || ''}`;
    return restrictedKeywords.some((keyword) => text.includes(keyword));
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
            const placeEmbeddingFiltered = await safeEmbedText(dbNamesFiltered);
            console.timeEnd('db_embed_time');

            // 기존 DB 로딩
            console.time('product_load_time');
            let mongoFilter = { isActive: { $ne: false } }; // 기본적으로 활성화된 상품만 불러오기
            mongoFilter['countries'] = targetCountries[i];
            let products = await SellingProduct.find(mongoFilter).lean();
            console.log('products 갯수 - ', products.length);
            console.timeEnd('product_load_time');

            const existingProdNos = new Set(products.map((p) => p.prod_no));
            const existingCacheMap = new Map(products.map((p) => [p.prod_no, p]));

            page = 0;

            let kkdayProdNos = new Set();

            while (true) {
                const response = await kkdayPost('Search', {
                    country_keys: [country_codes[i]],
                    page_size: pageSize,
                    start: page * pageSize,
                    locale: 'ko',
                });

                if (!response.prods || response.prods.length === 0) break;

                // 현재 나라의 상품 prod_no만 기록
                response.prods.forEach((p) => kkdayProdNos.add(p.prod_no));

                //if (page > 2) break; // TODO - 본서버 적용때는 주석처리!!!

                const newProducts = response.prods
                    // 먼저 국가 2개 이상인 상품은 아예 제외
                    .filter((p) => !p.countries || p.countries.length <= 1)
                    .map((p) => {
                        const cached = existingCacheMap.get(p.prod_no);

                        const alwaysUpdate = {
                            b2c_price: Math.round(p.b2c_price * 1.1), //TODO - 이후 제거
                            b2b_price: p.b2b_price,
                            order_count: p.order_count,
                            rating_count: p.rating_count,
                            avg_rating_star: p.avg_rating_star,
                            earliest_sale_date: p.earliest_sale_date,
                            //countries: p.countries,
                        };

                        const needLLM =
                            !cached || cached.prod_name !== p.prod_name || cached.introduction !== p.introduction;

                        return needLLM
                            ? { ...p, ...alwaysUpdate, needLLM: true }
                            : { ...cached, ...alwaysUpdate, needLLM: false };
                    });

                const processedProducts = await asyncPool(3, newProducts, async (product) => {
                    //TODO - 상황 보고 괜찮으면 해제 ( 토스페이 최대 200 )
                    if (product.b2b_price >= 2000000) {
                        kkdayProdNos.delete(product.prod_no); // isActive : False로 변경
                        return null; // processedProducts에 저장 안 됨
                    }
                    if (product.b2b_price > product.b2c_price) {
                        kkdayProdNos.delete(product.prod_no); // isActive : False로 변경
                        return null; // processedProducts에 저장 안 됨
                    }

                    if (isRestrictedProduct(product)) {
                        console.warn(`[PG 제한상품 비활성화] ${product.prod_no} - ${product.prod_name}`);
                        kkdayProdNos.delete(product.prod_no); // isActive : False로 변경
                        return null; // processedProducts에 저장 안 됨
                    }

                    // 세부 정보 조회 (상품 스케줄 포함)
                    let fullProduct = null;
                    try {
                        fullProduct = await kkdayPostWithRetry(
                            '/Product/QueryProduct',
                            {
                                prod_no: product.prod_no,
                                locale: 'ko',
                            },
                            3,
                            2000
                        ); // 최대 3회, 초기 2초 대기
                    } catch (err) {
                        console.error(`[ERROR] QueryProduct 실패: ${product.prod_no}`, err.message);
                        fullProduct = null;
                    }

                    if (!fullProduct || fullProduct.result !== '00') {
                        console.log(`[WARN] fullProduct 없음: ${product.prod_no} - LLM 처리 건너뜀`);
                        kkdayProdNos.delete(product.prod_no); // isActive : False로 변경
                        return null; // processedProducts에 저장 안 됨
                    }

                    // product_category.main만 추출
                    let category = {};
                    let mainCategory = '';
                    const prodData = fullProduct?.prod; // 안전하게 접근

                    if (prodData && typeof prodData.product_category === 'object') {
                        category = prodData.product_category;
                        mainCategory = prodData.product_category?.main || null;
                        //console.log(category);
                    } else {
                        console.warn(`[WARN] product_category 없음: ${product.prod_no}`);
                    }

                    // QueryProduct 체크는 매번 해야함
                    if (!product.needLLM)
                        return {
                            ...product,
                            product_category: category,
                            product_category_main: mainCategory,
                        };
                    else console.log('LLM  필요 - ', product.prod_name);

                    // //TODO - 업데이트하고 제거
                    // let isTravelerOnlyTemp = await isTravelerOnlyProduct(product);
                    // if (!product.needLLM)
                    //     return {
                    //         ...product,
                    //         product_category: category,
                    //         product_category_main: mainCategory,
                    //         isTravelerOnly: isTravelerOnlyTemp,
                    //     };

                    // 관광지 배열 뽑기
                    const { extractedPlaces, normalizedPlaces } = await extractPlacesFromSchedule(
                        fullProduct,
                        dbPlacesFiltered,
                        placeEmbeddingFiltered
                    );

                    // sellingProductPlaceList가 있으면 추가 병합
                    const productPlaces = [...(product.sellingProductPlaceList || []), ...extractedPlaces];

                    // product.isNationwide가 undefined/null이면 처리
                    let isNationwide = product.isNationwide ?? false;

                    if (!product.hasOwnProperty('isNationwide') || product.isNationwide === undefined) {
                        // 기존 값이 없을 때만 함수 호출
                        isNationwide = await isNationwideProduct(product);
                    }

                    // product.isTravelerOnly가 undefined/null이면 처리
                    let isTravelerOnly = product.isTravelerOnly ?? false;

                    if (!product.hasOwnProperty('isTravelerOnly') || product.isTravelerOnly === undefined) {
                        // 기존 값이 없을 때만 함수 호출
                        isTravelerOnly = await isTravelerOnlyProduct(product);
                    }

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

                    let embedding = [];
                    let embeddingRes = [];

                    // 상품 텍스트 기반 임베딩 계산
                    embeddingRes = await embedText(productText);

                    // OpenAI는 항상 2차원 배열 리턴 → 첫 번째 요소만 꺼냄
                    embedding = embeddingRes[0];

                    /*
                    product: {
                        result: '02',
                        result_msg: "MISSING_FIELD:These Product type can't support API. Please Go website to Order It."
                    }
                    위 경우에는 아예 몽고db에 저장도 안하게 외부에서 처리
                    KKday API가 "MISSING_FIELD" 응답한 경우 → 저장 스킵
                    */
                    if (fullProduct?.result === '02' && fullProduct?.result_msg?.startsWith('MISSING_FIELD')) {
                        // console.warn('[CACHE][WARN] API 미지원 상품 스킵', {
                        //     productId: product?.prod_no || 'unknown',
                        //     result: fullProduct.result,
                        //     result_msg: fullProduct.result_msg,
                        // });
                        kkdayProdNos.delete(product.prod_no); // isActive : False로 변경
                        return null; // processedProducts에 저장 안 됨
                    }

                    return {
                        ...product,
                        isNationwide,
                        isTravelerOnly,
                        tendencyScores,
                        embedding,
                        productPlaces,
                        normalizedPlaces,
                        product_category: category,
                        product_category_main: mainCategory,
                        ...product.alwaysUpdate,
                    };
                });

                // 끝나고 한 번에 넣어서 끊기지 않게!
                // productCache = allProducts;

                // MongoDB에 bulk 업서트
                const bulkOps = processedProducts
                    .filter((p) => p) // null/undefined 제거 -> 미지원 상품 스킵
                    .map((p) => {
                        // 국가 이름 배열
                        const simplifiedCountries = (p.countries || [])
                            .map((c) => {
                                if (typeof c === 'string') return c; // 이미 문자열일 때
                                if (c && typeof c === 'object') return c.name; // 객체일 때
                                return null;
                            })
                            .filter(Boolean); // null 제거

                        // 도시 이름 배열 (국가 배열 안의 모든 city.name 평탄화)
                        const simplifiedCities = (p.countries || []).flatMap((c) => {
                            if (typeof c === 'string') return p.cities; // 이미 countries가 문자열이면 이미 저장된 도시 정보 활용
                            if (c && Array.isArray(c.cities)) {
                                return c.cities
                                    .map((city) => {
                                        if (!city || !city.name) return null;
                                        const parts = city.name.split(',');
                                        return parts[parts.length - 1].trim();
                                    })
                                    .filter(Boolean); // null, "" 같은 값 제거
                            }
                            return [];
                        });

                        // 한글 여부 검사
                        let isActive = true;
                        const noKorean = !containsKorean(p.prod_name) || !containsKorean(p.introduction);

                        // 한글 없으면 비활성화
                        if (noKorean) {
                            isActive = false;
                        }

                        return {
                            updateOne: {
                                filter: { prod_no: p.prod_no },
                                update: {
                                    $set: {
                                        ...p,
                                        countries: simplifiedCountries, // ["베트남", "태국", ...]
                                        cities: simplifiedCities, // ["모든 도시", "다낭", ...]
                                        sellingProductRating: p.avg_rating_star,
                                        sellingProductReviewCount: p.rating_count,
                                        isActive: isActive, // 다시 들어온 상품은 활성화
                                        lastSyncedAt: new Date(), // 동기화 시간 기록
                                    },
                                },
                                upsert: true,
                            },
                        };
                    });

                const prevDebug = mongoose.get('debug'); // 현재 debug 상태 저장
                try {
                    mongoose.set('debug', false); // bulkWrite 로그 끄기
                    await SellingProduct.bulkWrite(bulkOps);
                } catch (error) {
                    console.error('bulkWrite 로그 끄기 실패');
                    await SellingProduct.bulkWrite(bulkOps);
                } finally {
                    mongoose.set('debug', prevDebug); // 원래 상태 복원
                }

                allProducts.push(...processedProducts);
                page++;
                console.log(`[CACHE] 상품 수집 완료 (누적: ${allProducts.length})`);
            }

            // 나라별 삭제/비활성화 처리 (메모리 안전)
            const missingProdNos = [...existingProdNos].filter((id) => !kkdayProdNos.has(id));

            if (missingProdNos.length > 0) {
                console.log(`[CACHE][${targetCountries[i]}] 삭제/비활성화 대상 상품: ${missingProdNos.length}개`);
                //console.error(`[CACHE][${targetCountries[i]}] 삭제/비활성화 대상 상품: ${missingProdNos.length}개`);

                await SellingProduct.updateMany(
                    { prod_no: { $in: missingProdNos } },
                    { $set: { isActive: false, lastSyncedAt: new Date() } }
                );
            }

            console.log(`[CACHE][${targetCountries[i]}] 완료. (총 ${kkdayProdNos.size}개 상품 유지)`);
        }
        return allProducts.length;
    } catch (error) {
        console.error('[CACHE] 상품 캐시 갱신 실패:', error);
    }
}

async function getDistinctCities() {
    const cities = await SellingProduct.aggregate([
        { $unwind: '$cities' },
        { $match: { cities: { $ne: '모든 도시' } } }, // "모든 도시" 제외
        { $group: { _id: { countries: '$countries', city: '$cities' } } },
    ]);
    // { country, city } 형태로 반환
    return cities.map((c) => ({
        country: c._id.countries[0], // 배열 첫 번째 원소 사용
        city: c._id.city,
    }));
}

function groupByCountry(cities) {
    const grouped = {};
    for (const { country, city } of cities) {
        if (!grouped[country]) grouped[country] = [];
        grouped[country].push(city);
    }
    // 중복 제거
    for (const key of Object.keys(grouped)) {
        grouped[key] = [...new Set(grouped[key])];
    }
    return grouped;
}

function buildPrompt(country, productCities) {
    if (!domesticRegions[country]) {
        console.warn(`[WARN] domesticRegions에 ${country} 키가 없습니다.`);
        return null; // 혹은 빈 배열로 처리
    }
    return `
  당신은 여행 상품의 지역명을 표준화하는 전문가입니다.
  
  [기준 지역명 리스트]
  ${domesticRegions[country].join(', ')}
  
  [상품 지역명 리스트: ${country}]
  ${productCities.join(', ')}
  
  기준 지역명 리스트의 각 항목을 상품 지역명 리스트 중 가장 적절한 것과 매칭해 주세요.
  만약 매칭할 수 없으면 null로 표시하세요.
  
  출력 형식 (JSON):
  {
    "기준 지역명": "상품 지역명 또는 null",
    ...
  }
  `;
}
async function createSynonymDict(country, productCities) {
    const prompt = buildPrompt(country, productCities);

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
    });

    const content = completion.choices[0].message.content;

    // JSON 파싱 시도
    try {
        return parseLLMJson(content);
    } catch (e) {
        console.error(`[ERROR] ${country} 응답 JSON 파싱 실패:\n`, e);
        return {};
    }
}
function parseLLMJson(llmContent) {
    try {
        // ```json ... ``` 제거
        const cleaned = llmContent
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn('[WARN] LLM JSON 파싱 실패, fallback 처리');
        // fallback: 간단하게 key-value 추출
        const dict = {};
        const lines = llmContent.split('\n').filter((l) => l.includes(':'));
        for (const line of lines) {
            const match = line.match(/"(.+?)"\s*:\s*(null|"(.+?)")/);
            if (match) dict[match[1]] = match[3] || null;
        }
        return dict;
    }
}

// async function createRegionMap() {
//     const cities = await getDistinctCities();
//     const grouped = groupByCountry(cities);

//     const finalDict = {};

//     for (const [country, cityList] of Object.entries(grouped)) {
//         console.log(`👉 ${country} (${cityList.length}개 지역) 매핑 중...`);

//         const dict = await createSynonymDict(country, cityList);
//         finalDict[country] = dict;
//     }
//     await fs.writeFile(CACHE_FILE, JSON.stringify(finalDict, null, 2));
//     await fs.writeFile(CACHE_FILE2, JSON.stringify(grouped, null, 2));

//     console.log('✅ 모든 나라 처리 완료. 결과: region_synonyms.json 저장됨');
//     process.exit(0);
// }

// ======================
// 서버 시작 시 캐시 초기화
// TODO - 본서버에서 초기화 후 삭제
// ======================
// (async () => {
//     if (isUpdating) {
//         console.log('[CRON] 이전 갱신 작업이 아직 진행 중입니다. 건너뜁니다.');
//         return;
//     }
//     try {
//         isUpdating = true;
//         await updateProductCache();
//     } finally {
//         isUpdating = false;
//     }
// })();

// ======================
// 하루 1회 새벽 3시에 갱신 (cron: "0 3 * * *")
// ======================
// cron 표현식: 매일 18시에 실행 (18시 0분 0초)
cron.schedule(
    '0 0 3 * * *',
    async () => {
        console.log('[CRON] KKday 상품 캐시 갱신 시작...');

        if (isUpdating) {
            console.log('[CRON] 이전 갱신 작업이 아직 진행 중입니다. 건너뜁니다.');
            return;
        }
        try {
            isUpdating = true;
            resultLen = await updateProductCache();
            isUpdating = false;

            //관리자에게 알림 보내기

            try {
                const userId = '6609f7a4faac39d8516b25b2'; // 관리자 _id
                const user = await User.findOne({ _id: userId });

                if (user && user.fcmToken) {
                    const payload = {
                        notification: {
                            title: '캐시 업뎃 완료' + String(resultLen),
                            body: String(resultLen),
                        },
                        data: {
                            // 여기에 필요한 데이터를 추가할 수 있습니다.
                            // 예: noteId, senderId 등
                        },
                        token: user.fcmToken,
                    };

                    try {
                        //await admin.messaging().sendToDevice(user.fcmToken, payload);
                        await admin.messaging().send(payload);
                    } catch (error) {
                        // fcmToken이 유효하지 않은 경우 삭제
                        if (
                            error.code === 'messaging/registration-token-not-registered' ||
                            (error.errorInfo && error.errorInfo.code === 'messaging/registration-token-not-registered')
                        ) {
                            console.log('유효하지 않은 FCM 토큰 삭제:', user.fcmToken);
                            user.fcmToken = null;
                            await user.save();
                        } else {
                            console.error('FCM 전송 에러:', error);
                        }
                    }
                }
                // }
            } catch (error) {
                console.error('푸시 알림 전송 중 에러:', error);
            }
        } finally {
            isUpdating = false;
        }
    },
    {
        scheduled: true,
        timezone: 'Asia/Seoul', // 시간대 설정
    }
);

const domesticRegions = {
    한국: [
        '강원 강릉시',
        '강원 고성군',
        '강원 동해시',
        '강원 삼척시',
        '강원 속초시',
        '강원 양구군',
        '강원 양양군',
        '강원 영월군',
        '강원 원주시',
        '강원 인제군',
        '강원 정선군',
        '강원 철원군',
        '강원 춘천시',
        '강원 태백시',
        '강원 평창군',
        '강원 홍천군',
        '강원 화천군',
        '강원 횡성군',
        '경기 가평군',
        '경기 고양시',
        '경기 과천시',
        '경기 광명시',
        '경기 광주시',
        '경기 구리시',
        '경기 군포시',
        '경기 김포시',
        '경기 남양주시',
        '경기 동두천시',
        '경기 부천시',
        '경기 성남시',
        '경기 수원시',
        '경기 시흥시',
        '경기 안산시',
        '경기 안성시',
        '경기 안양시',
        '경기 양주시',
        '경기 양평군',
        '경기 여주시',
        '경기 연천군',
        '경기 오산시',
        '경기 가평군',
        '경기 고양시',
        '경기 과천시',
        '경기 광명시',
        '경기 광주시',
        '경기 구리시',
        '경기 군포시',
        '경기 김포시',
        '경기 남양주시',
        '경기 동두천시',
        '경기 부천시',
        '경기 성남시',
        '경기 수원시',
        '경기 시흥시',
        '경기 안산시',
        '경기 안성시',
        '경기 안양시',
        '경기 양주시',
        '경기 양평군',
        '경기 여주시',
        '경기 연천군',
        '경기 오산시',
        '경기 용인시',
        '경기 의왕시',
        '경기 의정부시',
        '경기 이천시',
        '경기 파주시',
        '경기 평택시',
        '경기 포천시',
        '경기 하남시',
        '경기 화성시',
        '경남 거제시',
        '경남 거창군',
        '경남 고성군',
        '경남 김해시',
        '경남 남해군',
        '경남 밀양시',
        '경남 사천시',
        '경남 산청군',
        '경남 양산시',
        '경남 의령군',
        '경남 진주시',
        '경남 창녕군',
        '경남 창원시',
        '경남 통영시',
        '경남 하동군',
        '경남 함안군',
        '경남 함양군',
        '경남 합천군',
        '경북 경산시',
        '경북 경주시',
        '경북 고령군',
        '경북 구미시',
        '경북 김천시',
        '경북 문경시',
        '경북 봉화군',
        '경북 상주시',
        '경북 성주군',
        '경북 안동시',
        '경북 영덕군',
        '경북 영양군',
        '경북 영주시',
        '경북 영천시',
        '경북 예천군',
        '경북 울릉군',
        '경북 울진군',
        '경북 의성군',
        '경북 청도군',
        '경북 청송군',
        '경북 칠곡군',
        '경북 포항시',
        '광주 전체',
        '대구 전체',
        '대전 전체',
        '부산 전체',
        '서울 도심권',
        '서울 동남권',
        '서울 동북권',
        '서울 서남권',
        '서울 서북권',
        '세종 전체',
        '울산 전체',
        '인천 전체',
        '전남 강진군',
        '전남 고흥군',
        '전남 곡성군',
        '전남 광양시',
        '전남 구례군',
        '전남 나주시',
        '전남 담양군',
        '전남 목포시',
        '전남 무안군',
        '전남 보성군',
        '전남 순천시',
        '전남 신안군',
        '전남 여수시',
        '전남 영광군',
        '전남 영암군',
        '전남 완도군',
        '전남 장성군',
        '전남 장흥군',
        '전남 진도군',
        '전남 함평군',
        '전남 해남군',
        '전남 화순군',
        '전북 고창군',
        '전북 군산시',
        '전북 김제시',
        '전북 남원시',
        '전북 무주군',
        '전북 부안군',
        '전북 순창군',
        '전북 완주군',
        '전북 익산시',
        '전북 임실군',
        '전북 장수군',
        '전북 전주시',
        '전북 정읍시',
        '전북 진안군',
        '제주 서귀포시',
        '제주 제주시',
        '충남 계룡시',
        '충남 공주시',
        '충남 금산군',
        '충남 논산시',
        '충남 당진시',
        '충남 보령시',
        '충남 부여군',
        '충남 서산시',
        '충남 서천군',
        '충남 아산시',
        '충남 예산군',
        '충남 천안시',
        '충남 청양군',
        '충남 태안군',
        '충남 홍성군',
        '충북 괴산군',
        '충북 단양군',
        '충북 보은군',
        '충북 영동군',
        '충북 옥천군',
        '충북 음성군',
        '충북 제천시',
        '충북 증평군',
        '충북 진천군',
        '충북 청주시',
        '충북 충주시',
    ],
    일본: [
        '도쿄',
        '요코하마',
        '가마쿠라',
        '가나가와현',
        '치바',
        '치바현',
        '군마현',
        '이바라키현',
        '나고야',
        '나가노',
        '후쿠이',
        '다카야마',
        '가루이자와마치',
        '시즈오카현',
        '야마나시현',
        '오사카',
        '교토',
        '고베',
        '나라',
        '와카야마',
        '와카야마현',
        '후쿠오카',
        '나가사키',
        '유후',
        '가고시마',
        '오키나와',
        '삿포로',
        '오타루',
        '하코다테',
        '비에이',
        '후라노',
        '가미후라노',
        '아사히카와',
        '니세코',
        '도오 지방',
        '도난 지방',
        '도호쿠 지방',
        '도토 지방',
        '센다이',
        '미야기현',
        '히로시마',
        '오카야마',
        '다카마쓰',
    ],
    중국: [
        '베이징',
        '톈진',
        '하얼빈',
        '다롄',
        '상하이',
        '난징',
        '쑤저우',
        '항저우',
        '칭다오',
        '옌타이',
        '샤먼',
        '홍콩',
        '마카오',
        '장가계',
        '하이난',
        '광저우',
        '심천',
        '계림',
        '청두',
        '충칭',
        '리장',
        '쿤밍',
        '시안',
        '둔황',
    ],
    베트남: [
        '하노이',
        '하이퐁',
        '닌빈',
        '박닌',
        '빈푹',
        '다낭',
        '호이안',
        '나트랑',
        '판티엣',
        '꾸이년',
        '빈 투언',
        '후에',
        '꽝빈성',
        '탄호아',
        '호치민시',
        '동나이',
        '콘다오',
        '하롱베이',
        '하장',
        '랑손',
        '타이 응우옌',
        '박장',
        '사파',
        '라오까이',
        '달랏',
        '닥락',
        '람동',
        '푸꾸옥 섬',
        '깐토',
        '띠엔장',
        '동탑',
    ],
    태국: [
        '치앙마이',
        '치앙라이',
        '람팡',
        '매홍손',
        '빠이',
        '우돈타니',
        '나콘라차시마',
        '농카이',
        '후아힌',
        '칸차나부리',
        '딱',
        '방콕',
        '수코타이',
        '프라나콘시 아유타야',
        '우타이타니',
        '사뭇 프라칸',
        '파타야',
        '라용',
        '찬타부리',
        '촌부리',
        '사뭇 사콘',
        '사뭇 송크람',
        '푸켓',
        '사무이 섬',
        '핫야이',
        '피피돈 섬',
        '사멧 섬',
        '코창',
        '뜨랏',
        '수랏타니',
        '나콘시탐마랏',
        '송클라',
        '사툰',
        '춤폰',
        '카오락',
        '팡아',
    ],
    필리핀: [
        '마닐라',
        '바기오',
        '비간',
        '팔라완',
        '사가다',
        '바나웨',
        '레가스피',
        '안티폴로',
        '일로코스',
        '잠발레스',
        '바탕가스',
        '라구나',
        '앙헬레스',
        '팡가시난',
        '따가이따이',
        '보라카이',
        '세부',
        '보홀',
        '시키호르',
        '일로일로',
        '다바오',
        '카가얀 데 오로',
        '시아르가오',
    ],
    싱가포르: ['싱가포르'],
    '홍콩과 마카오': ['홍콩', '마카오'],
};

module.exports = router;
