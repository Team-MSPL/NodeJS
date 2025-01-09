const mongoose = require('mongoose');

const { Schema } = mongoose;

const aiRecommendPlaceLogSchema = new Schema({
    //유저 ID
    userId: {
        type: String, // 자료형
    },
    //여행 지역 리스트
    region: {
        type: [String], // 자료형
    },
    //자차, 대중교통 구분
    transit: {
        type: Number,
    },
    //여행 성향 리스트 - selectList
    tendency: {
        type: [[Number]],
    },
    //여행 반경 / 거리 민감도
    distanceSensitivity: {
        type: Number,
    },
    //기준점의 위도
    lat: {
        type: Number,
    },
    //기준점의 경도
    lng: {
        type: Number,
    },
    //비밀번호 - 어디서 접속했는지 확인용
    password: {
        type: String,
    },
});

module.exports = mongoose.model('AIRecommendPlaceLog', aiRecommendPlaceLogSchema);
