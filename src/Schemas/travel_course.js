const mongoose = require('mongoose');

const { Schema } = mongoose;

//타임테이블 타입
let TimetableType = {
    category: Number,
    lat: Number,
    lng: Number,
    name: String,
    takenTime: Number,
    x: Number,
    y: Number,
    id: String,
};

const travelCourseSchema = new Schema({
    //유저 ID - 유저가 회원가입, 로그인할때, 기본 제공 되는 _id (ObjectId)
    userId: {
        type: String, // 자료형
        required: true, // 필수 여부
        unique: true, // 고유 값
    },
    //여행 ID - 여행을 저장할때, 기본 제공 되는 _id (ObjectId)
    // travelId: {
    //     type: String, // 자료형
    // },
    //여행 지역 리스트
    region: {
        type: [String], // 자료형
        required: true, // 필수 여부
    },
    //여행 일정
    day: {
        type: [String],
        required: true,
    },
    //여행 일정 총 몇일?
    nDay: {
        type: Number,
        required: true,
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
    //여행 일정
    timetable: {
        type: [[TimetableType]],
        required: true,
    },
    timetable: {
        type: [
            [
                {
                    type: TimetableType,
                    required: true,
                },
            ],
        ],
        required: true,
    },
});

module.exports = mongoose.model('TravelCourse', travelCourseSchema);
