const mongoose = require('mongoose');

const { Schema } = mongoose;

//타임테이블 타입
let TimetableType = {
    category: Number,
    lat: Number,
    lng: Number,
    name: String,
    address: {
        type: String,
        default: '',
    },
    takenTime: Number,
    x: Number,
    y: Number,
    id: String,
    photo: String,
    regionIndex: {
        type: Number,
        default: 0,
    },
};

const travelCourseSchema = new Schema({
    //여행 제목
    travelName: {
        type: String, // 자료형
        required: true, // 필수 여부
        default: '여행 제목', //기본값
    },
    //유저 ID - 유저가 회원가입, 로그인할때, 기본 제공 되는 _id (ObjectId)
    userId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //공유 받은 유저들 ID 리스트
    sharedUserList: {
        type: [String], // 자료형
    },
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
    //타임테이블
    // timetable: {
    //     type: [[TimetableType]],
    //     required: true,
    // },
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
    //여행 일기
    diary: {
        type: String,
        default: '', //기본값
    },
    //여행 사진
    picture: {
        type: [String],
        default: [], //기본값
    },
    //여행 리뷰 & 별점 유무
    reviewCheck: {
        type: Boolean,
        default: false, //기본값
    },
});

module.exports = mongoose.model('TravelCourse', travelCourseSchema);
