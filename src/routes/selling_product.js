const express = require('express');
const router = express.Router();
const SellingProduct = require('../schemas/selling_product.js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

var _ = require('lodash');

// 판매 상품 목록 가져오기 ( 5개씩 )
// 프론트에서 다이어로그를 띄우기 전에 먼저 이 API를 쏘고, 결과가 있으면 띄움 ( AI 실행 로딩 때 같이 쏘면 될듯 )
router.get('/list', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const page = req.query.page || 1; // 페이지 번호를 쿼리 매개변수로 받아옵니다.
        const perPage = 5; // 페이지당 게시물 수

        // 해당 국가의 모든 판매 상품을 가져옴
        const allProducts = await SellingProduct.find({
            sellingProductCountry: query.country,
            sellingProductCompany: query.company,
        });

        if (!allProducts || allProducts.length === 0) {
            return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
        }

        let sellingProducts = [];

        //1. 투어 상품일 경우, 유사도 리턴 x
        if (req.query.sellingProductType == 'tour') {
            // 각 상품에 대해 필터링 작업 수행
            allProducts.forEach((product) => {
                const productPlaces = product.sellingProductPlaceList;

                // '전체'가 첫 번째 원소일 경우
                if (productPlaces[0] === '전체') {
                    //똑같이 PlaceList가 '전체'이더라도 region이 같으면 더 위로
                    if (product.sellingProductRegion == query.region) {
                        sellingProducts.push({ product, matchCount: 0 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                    } else {
                        sellingProducts.push({ product, matchCount: -1 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                    }
                    return;
                }

                // query.placeList 와 겹치는 원소 찾기
                const matchingPlaces = productPlaces.filter((place) => query.placeList.includes(place));
                const matchCount = matchingPlaces.length;

                // 겹치는 원소가 있을 경우 배열에 추가
                if (matchCount > 0) {
                    filteredProducts.push({ product, matchCount });
                }
            });
        }
        //2. 패키지 상품, 유사도 리턴 o
        else if (req.query.sellingProductType == 'package') {
            // 각 상품에 대해 필터링 작업 수행
            allProducts.forEach((product) => {
                const productPlaces = product.sellingProductPlaceList;

                // '전체'가 첫 번째 원소일 경우
                if (productPlaces[0] === '전체') {
                    //똑같이 PlaceList가 '전체'이더라도 region이 같으면 더 위로
                    if (product.sellingProductRegion == query.region) {
                        sellingProducts.push({ product, matchCount: 0, similarity: -1 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                    } else {
                        sellingProducts.push({ product, matchCount: -1, similarity: -1 }); // matchCount: Infinity로 수정하면 배열의 맨 앞으로 옮길 수 있음
                    }
                    return;
                }

                // query.placeList 와 겹치는 원소 찾기
                const matchingPlaces = productPlaces.filter((place) => query.placeList.includes(place));
                const matchCount = matchingPlaces.length;

                // 겹치는 원소가 있을 경우 배열에 추가
                if (matchCount > 0) {
                    filteredProducts.push({ product, matchCount, similarity: matchCount / query.placeList.length });
                }
            });
        } else {
            return res.status(403).json({ message: 'sellingProductType가 적절한 값이 아닙니다.' });
        }
        // matchCount가 많은 순으로 정렬
        filteredProducts.sort((a, b) => b.matchCount - a.matchCount);

        // 총 필터링된 결과 수
        const resultsLength = filteredProducts.length;

        // 페이지네이션 적용: 필터링된 상품에서 필요한 페이지의 데이터만 추출
        const paginatedResults = filteredProducts
            .slice((page - 1) * perPage, page * perPage)
            .map((item) => item.product);

        //페이지 수를 알 수 있게, 필터링 된 관광지의 총 갯수를 리턴해줌
        res.status(200).json({
            results: paginatedResults,
            resultsLength: resultsLength,
        });
    } catch (error) {
        console.error('/sellingProducts/sellingProducts - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. 판매 상품 링크 클릭 횟수 저장하기
router.patch('/countLinkClick', async (req, res) => {
    try {
        const { sellingProductId } = req.body;

        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        SellingProduct.findOne({ _id: sellingProductId })
            .then(async (sellingProduct) => {
                if (!sellingProduct) {
                    console.log(sellingProduct);
                    return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
                }

                sellingProduct.sellingProductLinkClickCount += 1;

                await sellingProduct.save();

                res.status(200).json({ message: '판매 상품 링크 클릭 횟수 저장 완료.' });
            })
            .catch((error) => {
                console.error('SellingProduct.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 sellingProductId 입니다.' });
            });
    } catch (error) {
        console.error('/sellingProduct/save - PATCH 함수에 문제 발생 : ', error);
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
