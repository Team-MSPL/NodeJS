const express = require('express');
const router = express.Router();
const SellingProduct = require('../schemas/selling_product.js');
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

var _ = require('lodash');

// 문자열에서 괄호와 그 안의 내용을 제거하는 함수
function removeParentheses(str) {
    return str.replace(/\(.*$/g, '').trim();
}

// 괄호 안의 내용 제거 후 공백 제거
function normalizePlaceName(place) {
    return removeParentheses(place).replace(/\s+/g, '');
}

// 판매 상품 목록 가져오기 ( 5개씩 )
// 프론트에서 다이어로그를 띄우기 전에 먼저 이 API를 쏘고, 결과가 있으면 띄움 ( AI 실행 로딩 때 같이 쏘면 될듯 )
router.get('/list', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        //const page = req.query.page || 1; // 페이지 번호를 쿼리 매개변수로 받아옵니다.
        //const perPage = 5; // 페이지당 게시물 수

        const {
            country,
            company,
            regions, // 쉼표 구분 다중 값
            type, // tour, package, TODO - 이후 추가 예정
            period, // 정확히 일치 (Number)
            places, // 쉼표 구분 다중 값
            minPrice = 0,
            maxPrice = 100000000,
            minRating = 0.0,
            koreanGuideCheck = 'false',
            similarityMode = 'false',
            recommendMode = 'false',
            page = 1,
            limit = 20,
            likedOnly = 'false',
        } = req.query;

        // places가 undefined가 아니면 쉼표로 분리하고 각 원소의 앞뒤 공백을 제거
        const placeList = places ? places.split(',').map((place) => place.trim()) : [];

        // region이 undefined가 아니면 쉼표로 분리하고 각 원소의 앞뒤 공백을 제거
        const regionList = regions ? regions.split(',').map((r) => r.trim()) : [];
        const minP = minPrice ? Number(minPrice) : 0;
        const maxP = maxPrice ? Number(maxPrice) : Number.MAX_SAFE_INTEGER;
        const minR = minRating ? Number(minRating) : 0;
        const periodN = period ? Number(period) : undefined;
        const koreanGuide = koreanGuideCheck === 'true';
        const similarityMod = similarityMode === 'true';
        const recommend = recommendMode === 'true';
        const likedFlag = likedOnly === 'true';

        let sellingProducts = [];

        let likedIds = [];
        if (likedFlag) {
            try {
                // 클라이언트에서 전달한 JWT 토큰 추출
                const token = req.header('Authorization').split(' ')[1];

                // JWT 토큰 검증
                dotenv.config(); // .env 파일의 환경 변수 로드

                jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
                    if (err) {
                        console.error('JWT 토큰 검증 에러:', err);
                        return res.status(401).json({ message: 'Unauthorized' });
                    }

                    const user = await User.findById(decoded._id).select('productLikeList').lean();
                    if (!user) return res.status(404).json({ message: 'User not found' });

                    likedIds = user.productLikeList ?? [];
                });
                if (!likedIds.length) return res.json({ total: 0, data: [] }); // 찜 목록 비어 있으면 바로 종료
            } catch (e) {
                console.error('JWT / user fetch error:', e);
                return res.status(401).json({ message: 'Invalid token' });
            }
        }

        if (similarityMod) {
            // 해당하는 모든 판매 상품을 가져옴
            const allProducts = await SellingProduct.find({
                sellingProductCountry: country,
                sellingProductCompany: company,
                sellingProductRegion: { $in: regionList }, // 두 배열의 교집합을 찾음
                // 다른 조건도 추가 가능
            });

            if (!allProducts || allProducts.length === 0) {
                return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
            }

            //1. 투어 상품일 경우, 유사도 리턴 x
            if (type == 'tour') {
                // 각 상품에 대해 필터링 작업 수행
                allProducts.forEach((product) => {
                    const productPlaces = product.sellingProductPlaceList;

                    // '전체'가 첫 번째 원소일 경우
                    if (productPlaces[0] === '전체') {
                        //똑같이 PlaceList가 '전체'이더라도 region이 같으면 더 위로
                        if (regionList.includes(product.sellingProductRegion)) {
                            sellingProducts.push({ product, matchCount: 0 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                        } else {
                            sellingProducts.push({ product, matchCount: -1 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                        }
                    } else {
                        // // query.placeList 와 겹치는 원소 찾기
                        // const matchingPlaces = productPlaces.filter((place) => placeList.includes(place));

                        //console.log(placeList[0]);

                        // query.placeList와 겹치는 원소 찾기 (괄호 제외 + 공백 제외 후 완전 일치)
                        const matchingPlaces = productPlaces.filter((place) =>
                            placeList.some((queryPlace) => normalizePlaceName(place) === normalizePlaceName(queryPlace))
                        );

                        //console.log(normalizePlaceName(placeList[0]));
                        const matchCount = matchingPlaces.length;

                        // 겹치는 원소가 있을 경우 배열에 추가 + type이 투어 상품인 경우만
                        if (matchCount > 0 && product.sellingProductType == type) {
                            sellingProducts.push({ product, matchCount });
                        }
                    }
                });

                // matchCount가 많은 순으로 정렬하고, 같으면 rating이 높은 순으로 정렬
                sellingProducts.sort((a, b) => {
                    // matchCount가 다를 경우
                    if (b.matchCount !== a.matchCount) {
                        return b.matchCount - a.matchCount;
                    }
                    // matchCount가 같을 경우 sellingProductReviewCount 으로 정렬
                    return b.product.sellingProductReviewCount - a.product.sellingProductReviewCount;
                });
            }
            //2. 패키지 상품, 유사도 리턴 o
            else if (type == 'package') {
                // 각 상품에 대해 필터링 작업 수행
                allProducts.forEach((product) => {
                    const productPlaces = product.sellingProductPlaceList;

                    // '전체'가 첫 번째 원소일 경우
                    if (productPlaces[0] === '전체') {
                        //똑같이 PlaceList가 '전체'이더라도 region이 같으면 더 위로
                        if (regionList.includes(product.sellingProductRegion)) {
                            sellingProducts.push({ product, matchCount: 0, similarity: 0 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                        } else {
                            sellingProducts.push({ product, matchCount: -1, similarity: -1 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                        }
                    } else {
                        // // query.placeList 와 겹치는 원소 찾기
                        // const matchingPlaces = productPlaces.filter((place) => placeList.includes(place));

                        // query.placeList와 겹치는 원소 찾기 (괄호 제외 + 공백 제외 후 완전 일치)
                        const matchingPlaces = productPlaces.filter((place) =>
                            placeList.some((queryPlace) => normalizePlaceName(place) === normalizePlaceName(queryPlace))
                        );

                        const matchCount = matchingPlaces.length;

                        // similarity 는 두 경우 중 높은 쪽으로 넣기
                        similarity =
                            matchCount / placeList.length > matchCount / productPlaces.length
                                ? matchCount / placeList.length
                                : matchCount / productPlaces.length;

                        // 겹치는 원소가 있을 경우 배열에 추가 + 설정한 여행 기간 >= 패키지 상품 기간
                        if (matchCount > 0 && period >= product.sellingProductPeriod) {
                            sellingProducts.push({
                                product,
                                matchCount,
                                similarity: similarity,
                            });
                        }
                    }

                    // similarity 가 많은 순으로 정렬하고, 같으면 rating이 높은 순으로 정렬
                    sellingProducts.sort((a, b) => {
                        // similarity 가 다를 경우
                        if (b.similarity !== a.similarity) {
                            return b.similarity - a.similarity;
                        }
                        // similarity 가 같을 경우 sellingProductReviewCount 으로 정렬
                        return b.product.sellingProductReviewCount - a.product.sellingProductReviewCount;
                    });
                });
            } else {
                return res.status(403).json({ message: 'similarityMode, type 이 적절한 값이 아닙니다.' });
            }
        } else {
            /** ① Mongo 1차 필터 : 가격 조건은 빼고 나머지만 */
            const queryObj = {
                // 범위 조건
                //sellingProductPrice: { $gte: minP, $lte: maxP },  // sellingProductPriceDetail 사용
                sellingProductRating: { $gte: minR },
            };
            if (likedFlag) queryObj._id = { $in: likedIds };
            if (type) queryObj.sellingProductType = type;
            if (country) queryObj.sellingProductCountry = country;
            if (company) queryObj.sellingProductCompany = company;
            if (koreanGuide) queryObj.koreanGuide = koreanGuide;
            if (recommend) queryObj.recommend = recommend;

            if (regionList?.length) queryObj.sellingProductRegion = { $in: regionList };

            if (placeList?.length) queryObj.sellingProductPlaceList = { $in: placeList };

            if (periodN !== undefined) queryObj.sellingProductPeriod = periodN;

            const mongoProducts = await SellingProduct.find(queryObj).lean();

            function anyDetailInRange(detail) {
                for (const opt of Object.values(detail)) {
                    for (const price of Object.values(opt)) {
                        if (typeof price === 'number' && price >= minP && price <= maxP) {
                            return true;
                        }
                    }
                }
                return false;
            }

            // 수호천사 컴퍼니 매물들은 sellingProductPriceDetail가 없어서 에러남
            mongoProducts.forEach((p) => {
                if (anyDetailInRange(p.sellingProductPriceDetail)) sellingProducts.push({ product: p });
            });
        }
        // 총 필터링된 결과 수
        const resultsLength = sellingProducts.length;

        // 페이지네이션 적용: 필터링된 상품에서 필요한 페이지의 데이터만 추출 (어차피 AI 실행 때 같이 실행하면 한 번에 받아올 수 있음)
        // const paginatedResults = sellingProducts
        //     .slice((page - 1) * perPage, page * perPage)
        //     .map((item) => item.product);

        if (sellingProducts.length === 0) {
            return res.status(404).json({ message: '조건에 맞는 판매 상품이 없습니다.' });
        }

        const start = (page - 1) * limit;
        const end = start + Number(limit);

        //페이지 수를 알 수 있게, 필터링 된 관광지의 총 갯수를 리턴해줌
        res.status(200).json({
            total: resultsLength,
            page: Number(page),
            limit: Number(limit),
            data: sellingProducts.slice(start, end),
        });
    } catch (error) {
        console.error('/sellingProducts/list - GET 함수에 문제 발생 : ', error);
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
                    console.log(sellingProduct);
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
    if (!str) return 0;
    return Number(str.replace(/[^\d]/g, ''));
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
        sellingProductLink: data['링크'] || '',
        sellingProductLinkList: [data['링크'] || ''],
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
module.exports = router;
