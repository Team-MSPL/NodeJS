const mongoose = require('mongoose');

const { Schema } = mongoose;

//여권 정보 타입
let passportType = {
    korName: {
        // 한글 이름
        type: String,
        default: '',
    },
    engFirstName: String, // 영문 이름
    engLastName: String, // 영문 성
    country: String,
    passportNum: String,
    gender: String,
    birthday: String,
    passportIssueDate: String,
    passportExpirationDate: String,
    passportCountry: String,
    passportImage: {
        type: String,
        default: '',
    },
};

const bookingProductSchema = new Schema({
    //판매 상품 id
    sellingProductId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //유저 id
    userId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //여권 정보 등록 목록 - 재활용
    passportList: {
        type: [passportType], // 자료형
        default: [],
    },
    // 연락수단 Map  (키 = 수단 이름, 값 = 문자열)
    contact: {
        type: Map,
        of: String,
        default: {}, // 기본값은 빈 객체
        required: true, // 최소한 하나는 있어야 한다면 true
    },
    //여행 시작일
    startDate: {
        type: Date, // 자료형
    },
    //여행 종료일
    endDate: {
        type: Date, // 자료형
    },
    //인원 - 예) {"대인":1, "소인":1}
    personCount: {
        type: Map,
        of: Number,
        default: {},
    },
    //총 비용
    totalCost: {
        type: Number, // 자료형
        default: 0,
    },
    //픽업장소
    pickupPlace: {
        type: String, // 자료형
        default: '',
    },
    //드랍장소
    dropPlace: {
        type: String, // 자료형
        default: '',
    },
    //요청사항
    request: {
        type: String, // 자료형
        default: '',
    },
    // 별점
    reviewPoint: {
        type: Number, // 자료형
        default: 0.0,
    },
    // 후기
    review: {
        type: String, // 자료형
        default: '',
    },
    //확정취소여부
    confirm: {
        type: Boolean, // 자료형
    },
});

module.exports = mongoose.model('bookingProduct', bookingProductSchema);
