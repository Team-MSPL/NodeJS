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
    //유저 id
    userId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    booking_key: String,

    //여권 정보 등록 목록 - 재활용
    passportList: {
        type: [passportType], // 자료형
        default: [],
    },

    guid: { type: String, required: true },
    partner_order_no: String,
    order_no: { type: String }, // booking 고유값
    prod_no: { type: Number, required: true },
    pkg_no: Number,
    item_no: Number,
    locale: String,
    state: String,
    buyer: {
        first_name: String,
        last_name: String,
        email: String,
        tel_country_code: String,
        tel_number: String,
        country: String,
    },
    s_date: Date,
    e_date: Date,
    event_time: String,
    guide_lang: String,
    skus: [
        {
            sku_id: String,
            qty: Number,
            price: Number,
        },
    ],
    order_note: String,
    total_price: Number,
    pay_type: String,

    isActive: { type: Boolean, default: true }, // 활성 상태 필드

    // 상품 정보 (QueryProduct API 결과 일부 저장) - pkg 제외
    product: {
        type: mongoose.Schema.Types.Mixed,
    },

    created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('bookingProduct', bookingProductSchema);
