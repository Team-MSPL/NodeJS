const mongoose = require('mongoose');

const { Schema } = mongoose;

//타임테이블 타입
let TimetableType = {
    category: Number,
    lat: Number,
    lng: Number,
    name: String,
    address: String,
    takenTime: Number,
    x: Number,
    y: Number,
    id: String,
    photo: String,
};

const manageTravelSchema = new Schema({
    // travelId
    userId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    travelId: {
        type: String, // 자료형
        required: true, // 필수 여부
        //unique: true, // 고유 값 - 공유자도 리뷰를 남길 수가 있어서
    },
    review: {
        type: String, // 자료형
    },
    point: {
        type: Number, // 자료형
    },
    tendencyPoint: {
        type: [[Number]], // 자료형
    },

    // 아래는 여행 코스가 삭제되어도 리뷰된 여행 코스의 정보를 볼 수 있게 저장해두는 것.

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
    //여행 성향 리스트 - selectList
    tendency: {
        type: [[Number]],
        required: true,
    },
    //여행 일정
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
    },
    //여행 사진 - 여행지 리뷰에 사용
    photoList: {
        type: [String],
        default: [],
    },
});

module.exports = mongoose.model('ManageTravel', manageTravelSchema);
