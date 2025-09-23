const mongoose = require('mongoose');

const { Schema } = mongoose;

//링크 클릭 로그 타입
let clickLogType = {
    id: String,
    date: Date,
};

const sellingProductSchema = new Schema({
    //판매 상품 이름
    sellingProductName: {
        type: String, // 자료형
    },
    //판매 상품 타입 (tour, package)
    sellingProductType: {
        type: String,
    },
    //판매 상품 내용
    sellingProductContent: {
        type: String,
        default: '',
    },
    //판매 상품 세부 내용
    sellingProductContentDetail: {
        type: String,
        default: '',
    },
    //판매 상품 세부 내용_html
    sellingProductContentDetailHTML: {
        type: String,
        default: '',
    },
    //판매 상품 사진
    sellingProductImage: {
        type: [String],
        default: [],
    },
    //판매 상품 가격   //사용 X? //비공개로 할 경우 대비하여 필수 x, 0일 경우 처리 로직 구현할 것
    sellingProductPrice: {
        type: Number,
        default: 0,
    },
    //판매 상품 세부가격    // 예) {“상하이 우전수향마을 야경투어” : { “대인” : 93,600, “소인” : 78000 }}
    sellingProductPriceDetail: {
        type: Map, // 1단계: 옵션명(문자열) → 서브‧오브젝트
        of: Map, // 2단계: 구분(대인·소인 등) → 숫자
        default: {}, // 기본값
    },
    //판매 상품 여행 기간 ( 투어의 경우 -1 )
    sellingProductPeriod: {
        type: Number,
        default: 0,
    },
    //판매 상품 여행 시간 ( 9 -> 9시간 )
    sellingProductHour: {
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
    //판매 상품 국가 // 사용 안함
    sellingProductCountry: {
        type: String,
        default: '',
    },
    //판매 상품 국가 배열 // 여러 나라를 저장하기 위함
    sellingProductCountryList: {
        type: [String],
        default: [''],
    },
    //판매 상품 지역
    sellingProductRegion: {
        type: [String],
        default: [''],
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
    //판매 상품 링크 // 사용 안함
    sellingProductLink: {
        type: String,
        default: '',
    },
    //판매 상품 링크 배열
    sellingProductLinkList: {
        type: [String],
        default: [''],
    },
    //판매 상품 링크 클릭 로그
    sellingProductLinkClickLog: {
        type: [clickLogType],
        default: [],
    },
    tourCode: {
        type: String,
        default: '',
    },
    menuCode: {
        type: String,
        default: '',
    },
    //한국어가이드유무 : “Y” ( Y/N )
    koreanGuide: {
        type: String,
        default: 'N',
    },
    //추천 상품 ( 요즘뜨는 여행 상품 )
    recommend: {
        type: String,
        default: 'N',
    },
    prod_no: { type: Number }, // 숫자 그대로
    prod_name: { type: String },
    introduction: { type: String },
    prod_img_url: { type: String },
    prod_type: { type: String },
    prod_currency: { type: String },
    b2c_price: { type: Number },
    b2b_price: { type: Number },
    order_count: { type: Number },
    rating_count: { type: Number },
    avg_rating_star: { type: Number },
    earliest_sale_date: { type: String },
    countries: { type: Array, default: [] },
    cities: { type: Array, default: [] },
    isNationwide: { type: Boolean, default: false },
    normalizedPlaces: { type: [String], default: [] },
    productPlaces: { type: [String], default: [] },
    tendencyScores: { type: Object, default: {} },
    embedding: {
        type: [Number],
        //index: 'cosine', // MongoDB Atlas Vector Search용
    },
    introduction: { type: String },
    needLLM: { type: Boolean, default: false },
});

module.exports = mongoose.model('sellingProduct', sellingProductSchema);
