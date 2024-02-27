const mongoose = require('mongoose');

const { Schema } = mongoose;

//탐방 코스 추천 받은 사람들이 어떻게 받았는지 기록해두기 위함
const hikingSearchLogSchema = new Schema({
    //유저 Id
    userId: {
        type: String, // 자료형
    },
    //성향
    selectList: {
        type: [[Number]],
    },
    //난이도
    selectDifficulty: {
        type: [Number],
    },
});

module.exports = mongoose.model('HikingSearchLog', hikingSearchLogSchema);
