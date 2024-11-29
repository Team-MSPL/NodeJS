const mongoose = require('mongoose');

const { Schema } = mongoose;

//recentPosition 타입
let PositionType = {
    lat: Number,
    lng: Number,
};

//지역 추천 받은 사람들이 어떻게 받았는지 기록해두기 위함
const regionSearchLogSchema = new Schema({
    //유저 Id
    userId: {
        type: String, // 자료형
    },
    //성향
    selectList: {
        type: [[Number]],
    },
    //인기도
    selectPopular: {
        type: [Number],
    },
    //기준 위치
    recentPosition: {
        type: PositionType,
    },
    //이동 반경
    distanceSensitivity: {
        type: Number,
    },
    // 국가
    country: {
        type: String,
    },
});

module.exports = mongoose.model('RegionSearchLog', regionSearchLogSchema);
