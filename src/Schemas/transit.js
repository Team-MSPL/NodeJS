const mongoose = require('mongoose');

const { Schema } = mongoose;

const transitSchema = new Schema({
    //여행 ID 매칭용 - 여행코스 저장할때, 기본 제공 되는 _id (ObjectId)
    travelId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //일정 [출발, 도착]
    transitDay: {
        type: [String],
        required: true,
    },
    //공항, 역 [출발, 도착]
    port: {
        type: [String],
        default: [], //기본값
    },
    //항공사, 철도 ( 여러개 저장 가능 )
    line: {
        type: [String],
        default: [], //기본값
    },
    //예약번호 ( 여러개 저장 가능 )
    regNum: {
        type: [String],
        default: [], //기본값
    },
});

module.exports = mongoose.model('Transit', transitSchema);
