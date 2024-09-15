const mongoose = require('mongoose');

const { Schema } = mongoose;

const sellingProductSchema = new Schema({
    //판매 상품 이름
    sellingProductName: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //판매 상품 타입 (tour, package)
    sellingProductType: {
        type: String,
        required: true,
    },
    //판매 상품 내용
    sellingProductContent: {
        type: String,
        default: '',
    },
    //판매 상품 사진
    sellingProductImage: {
        type: [String],
        default: [],
    },
    //판매 상품 가격    //비공개로 할 경우 대비하여 필수 x, 0일 경우 처리 로직 구현할 것
    sellingProductPrice: {
        type: Number,
        default: 0,
    },
    //판매 상품 여행 기간 ( 패키지의 경우만 존재 )
    sellingProductPeriod: {
        type: Number,
        default: 0,
    },
    //판매 상품 별점
    sellingProductRating: {
        type: Number,
        default: 0.0,
    },
    //판매 상품 리뷰 수
    sellingProductReviewCount: {
        type: Number,
        default: 0,
    },
    //판매 상품 국가
    sellingProductCountry: {
        type: String,
        default: '',
    },
    //판매 상품 지역
    sellingProductRegion: {
        type: String,
        default: '',
    },
    //판매 상품 관광지 리스트 ( 투어 상품일 경우 원소 1개 / '전체'라면, 렌트카 상품 등 관광지 상관 없이 가능한 것 )
    sellingProductPlaceList: {
        type: [String],
        default: ['전체'],
    },
    //판매 상품 출처 ( 회사 ) //비공개로 할 경우 대비하여 필수 x
    sellingProductCompany: {
        type: String,
        default: '',
    },
    //판매 상품 링크
    sellingProductLink: {
        type: String,
        required: true,
    },
    //판매 상품 링크 클릭 횟수
    sellingProductLinkClickCount: {
        type: Number,
        default: 0,
    },
});

module.exports = mongoose.model('sellingProduct', sellingProductSchema);
