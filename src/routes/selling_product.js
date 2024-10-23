const express = require('express');
const router = express.Router();
const SellingProduct = require('../schemas/selling_product.js');
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

        const { country, company, regions, type, places, period } = req.query;

        // places가 undefined가 아니면 쉼표로 분리하고 각 원소의 앞뒤 공백을 제거
        const placeList = places ? places.split(',').map((place) => place.trim()) : [];

        // region이 undefined가 아니면 쉼표로 분리하고 각 원소의 앞뒤 공백을 제거
        const regionList = regions ? regions.split(',').map((r) => r.trim()) : [];

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

        let sellingProducts = [];

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

                    console.log(placeList[0]);

                    // query.placeList와 겹치는 원소 찾기 (괄호 제외 + 공백 제외 후 완전 일치)
                    const matchingPlaces = productPlaces.filter((place) =>
                        placeList.some((queryPlace) => normalizePlaceName(place) === normalizePlaceName(queryPlace))
                    );

                    console.log(normalizePlaceName(placeList[0]));
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
                            similarity: matchCount / placeList.length,
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
            return res.status(403).json({ message: 'type 이 적절한 값이 아닙니다.' });
        }

        // 총 필터링된 결과 수
        const resultsLength = sellingProducts.length;

        // 페이지네이션 적용: 필터링된 상품에서 필요한 페이지의 데이터만 추출 (어차피 AI 실행 때 같이 실행하면 한 번에 받아올 수 있음)
        // const paginatedResults = sellingProducts
        //     .slice((page - 1) * perPage, page * perPage)
        //     .map((item) => item.product);

        if (sellingProducts.length === 0) {
            return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
        }

        //페이지 수를 알 수 있게, 필터링 된 관광지의 총 갯수를 리턴해줌
        res.status(200).json({
            results: sellingProducts,
            resultsLength: resultsLength,
        });
    } catch (error) {
        console.error('/sellingProducts/list - GET 함수에 문제 발생 : ', error);
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
        const {
            sellingProductName,
            sellingProductType,
            sellingProductContent,
            sellingProductImage,
            sellingProductPrice,
            sellingProductPeriod,
            sellingProductRating,
            sellingProductReviewCount,
            sellingProductCountry,
            sellingProductRegion,
            sellingProductPlaceList,
            sellingProductCompany,
            sellingProductLink,
        } = req.body;

        const newSellingProduct = new SellingProduct({
            sellingProductName: sellingProductName,
            sellingProductType: sellingProductType,
            sellingProductContent: sellingProductContent,
            sellingProductImage: sellingProductImage,
            sellingProductPrice: sellingProductPrice,
            sellingProductPeriod: sellingProductPeriod,
            sellingProductRating: sellingProductRating,
            sellingProductReviewCount: sellingProductReviewCount,
            sellingProductCountry: sellingProductCountry,
            sellingProductRegion: sellingProductRegion,
            sellingProductPlaceList: sellingProductPlaceList,
            sellingProductCompany: sellingProductCompany,
            sellingProductLink: sellingProductLink,
        });

        const savedSellingProduct = await newSellingProduct.save();

        res.status(201).json({ sellingProductId: savedSellingProduct._id });
    } catch (error) {
        console.error('/sellingProduct/save - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
