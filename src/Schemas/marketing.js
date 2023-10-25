const mongoose = require('mongoose');

const { Schema } = mongoose;

const marketingSchema = new Schema({
    //유저 이름 or 쿠폰 이름
    name: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //전화번호
    phoneNum: {
        type: String,
        default: '',
    },
    //이메일
    email: {
        type: String,
        default: '',
    },
    provider: {
        type: String,
        default: '',
    },
    //쿠폰 사용자 목록 - 스키마의 name이 쿠폰 이름
    CouponUsedList: {
        type: [String],
        default: [],
    },
    //쿠폰 사용 기한
    couponEndDate: {
        type: Date,
        default: new Date('2024-01-01'),
    },
});

module.exports = mongoose.model('Marketing', marketingSchema);
