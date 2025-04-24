const mongoose = require('mongoose');

const { Schema } = mongoose;

//프리셋 타입
let PresetType = {
    category: Number,
    id: String,
    name: String,
    address: {
        type: String,
        default: '',
    },
    lat: Number,
    lng: Number,
    x: Number,
    y: Number,
    takenTime: Number,
    popular: Number,
    category: Number,
    photo: String,
    regionIndex: {
        type: Number,
        default: 0,
    },
};

//평균 점수 타입
let PointType = {
    tendencyNameList: [String],
    tendencyPointList: [Number],
    tendencyRanking: [Number],
};

const aiSchema = new Schema({
    //유저 ID
    userId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //여행 이름
    travelName: {
        type: String,
    },
    //여행 지역 리스트
    region: {
        type: [String], // 자료형
        required: true, // 필수 여부
    },
    //여행 일정
    day: {
        type: [String],
    },
    //여행 일정 총 몇일?
    nDay: {
        type: Number,
    },
    //자차, 대중교통 구분
    transit: {
        type: Number,
    },
    //여행 성향 리스트 - selectList
    tendency: {
        type: [[Number]],
        required: true,
    },
    // 시작 시간, 종료 시간
    timeLimitArray: {
        type: [[Number]],
    },
    //프리셋 ( AI 결과 )
    preset: {
        type: [
            [
                [
                    {
                        type: PresetType,
                        required: true,
                    },
                ],
            ],
        ],
        required: true,
    },
    //성향 평균 점수
    bestPointList: {
        type: [
            {
                type: PointType,
                required: true,
            },
        ],
    },
});

module.exports = mongoose.model('AI', aiSchema);
