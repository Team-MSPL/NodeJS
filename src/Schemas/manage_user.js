const mongoose = require('mongoose');

const { Schema } = mongoose;

//타임테이블 타입
let TokenLogType = {
    tokenLogContent: String,
    tokenLogNumber: Number,
    tokenLogDate: Date,
};

const manageUserSchema = new Schema({
    //토큰사용자 (userId)
    userId: {
        type: String,
        required: true,
    },
    //토큰 사용 횟수
    useTokenTime: {
        type: Number,
        default: 0,
    },
    //토큰 사용 로그 리스트
    tokenLog: {
        type: [
            {
                type: TokenLogType,
            },
        ],
        default: [],
    },
});

module.exports = mongoose.model('ManageUser', manageUserSchema);
