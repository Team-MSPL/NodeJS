const mongoose = require('mongoose');

const { Schema } = mongoose;

const placeSchema = new Schema({
    //이름
    name: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //지역
    region: {
        type: String,
        required: true,
    },
    //사진
    photo: {
        type: String,
        default: '',
    },
    //위도
    latitude: {
        type: Number,
        required: true,
        default: 0.0,
    },
    //경도
    longitude: {
        type: Number,
        required: true,
        default: 0.0,
    },
    //소요시간
    takenTime: {
        type: Number,
        required: true,
        default: 0.0,
    },
    //인기도
    popular: {
        type: Number,
        required: true,
        default: 0.0,
    },
    //로그인 방법
    loginProvider: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    functionToken: {
        type: Number,
        default: 0,
    },
});

module.exports = mongoose.model('Place', placeSchema);
