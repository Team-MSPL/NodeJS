const mongoose = require('mongoose');

const { Schema } = mongoose;
/**
 * 닉네임, 프로필이미지, 식별 토큰
 */
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
    //JWT토큰
    // userJwtToken: {
    //     type: String,
    //     unique: true, // 고유 값
    // },
    //로그인 방법
    loginProvider: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    recentLogin: {
        type: Date,
        //default: Date.now,
    },
    functionToken: {
        type: Number,
        default: 5,
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
});

module.exports = mongoose.model('User', userSchema);
