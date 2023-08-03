const mongoose = require('mongoose');

const { Schema } = mongoose;
/**
 * 닉네임, 프로필이미지, 파이어베이스토큰
 */
const userSchema = new Schema({
    //닉네임
    userName: {
        type: String, // 자료형
        required: true, // 필수 여부
        unique: true, // 고유 값
        default: true,
    },
    //프로필이미지
    userProfileImage: {
        type: String,
        required: true,
    },
    //파이어베이스 + 카카오 토큰
    userToken: {
        type: String,
        required: true,
    },
    comment: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('User', userSchema);
