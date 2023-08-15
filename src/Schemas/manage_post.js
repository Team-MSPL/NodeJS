const mongoose = require('mongoose');
const Post = require('../schemas/post.js');

const { Schema } = mongoose;

const managePostSchema = new Schema({
    //게시글 Id
    postId: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //신고 이유
    reportReason: {
        type: String,
        required: true,
    },
    //신고 시간
    reportedAt: {
        type: String,
        required: true,
    },
    //신고자 (userId)
    reportWriter: {
        type: String,
        required: true,
    },
    //게시글 원본 보존
    post: {
        type: Schema.Types.Mixed, // Mixed 타입으로 변경하여 객체 형태 데이터를 저장
        required: true,
    },
});

module.exports = mongoose.model('ManagePost', managePostSchema);
