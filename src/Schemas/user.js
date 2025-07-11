const mongoose = require('mongoose');

const { Schema } = mongoose;

//여권 정보 타입
let passportType = {
    korName: {
        // 한글 이름
        type: String,
        default: '',
    },
    engFirstName: String, // 영문 이름
    engLastName: String, // 영문 성
    country: String,
    passportNum: String,
    gender: String,
    birthday: String,
    passportIssueDate: String,
    passportExpirationDate: String,
    passportCountry: String,
    passportImage: {
        type: String,
        default: '',
    },
};

const userSchema = new Schema({
    //유저 ID - id는 기본 제공 되는 _id (ObjectId) 사용하자
    //닉네임
    userName: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //프로필이미지
    userProfileImage: {
        type: String,
        required: true,
    },
    //파이어베이스 + 카카오 토큰 ( 고유 값 )
    userToken: {
        type: String,
        required: true,
        unique: true, // 고유 값
    },
    //로그인 방법
    loginProvider: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    loginLogList: {
        type: [Date],
        default: [],
    }, //빼야하고
    recentLogin: {
        type: Date,
        //default: Date.now,
    },
    functionToken: {
        type: Number,
        default: 3, //회원가입시 디폴트 이용권 보상
    }, //빼야하고
    //푸시알림을 위한 fcm토큰
    fcmToken: {
        type: String,
        default: '',
    },
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
    //여행상품 찜 목록 - _id 저장
    productLikeList: {
        type: [String], // 자료형
        default: [],
    },
    //여권 정보 등록 목록 - 여러명 여권 등록할 수도 있으니
    passportList: {
        type: [passportType], // 자료형
        default: [],
    },
});

module.exports = mongoose.model('User', userSchema);
