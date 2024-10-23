const mongoose = require('mongoose');

const { Schema } = mongoose;

//tokenLog 타입
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
    //오늘자 광고 시청 횟수
    watchADTime: {
        type: Number,
        default: 0,
    },
    //최근 광고 시청 시간
    recentADDate: {
        type: Date,
    },

    //사용자 토큰 저장(회원탈퇴 후 복귀해도 토큰을 돌려주도록)
    userToken: {
        type: String,
        default: '',
    },
    functionToken: {
        type: Number,
        default: 5, //회원가입시 디폴트 보상
    }, //빼야하고
    //쪽지함
    noteList: {
        type: [String], // 자료형
        default: [],
    },
    //차단리스트
    blockUserList: {
        type: [String], // 자료형
        default: [],
    },
    //탈퇴사유
    withdrawReasonList: {
        type: [String], // 자료형
        default: [],
    },
    //탈퇴 시간사유
    withdrawDate: {
        type: Date,
        default: new Date('2024-01-01'),
    },
});

module.exports = mongoose.model('ManageUser', manageUserSchema);
