const mongoose = require('mongoose');

const { Schema } = mongoose;

//댓글 타입
let CommentType = {
    commentContent: String,
    commentedAt: String,
    commentWriter: String,
    userid: String,
};

const postSchema = new Schema({
    //게시글 제목
    postTitle: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //게시글 내용
    postContent: {
        type: String,
        required: true,
    },
    //게시글 사진
    postImage: {
        type: [String],
        default: [],
    },
    //게시글 작성자
    postWriter: {
        type: String,
        required: true,
    },
    //게시글 작성자의 userId
    postWriterUserId: {
        type: String,
        required: true,
    },
    //게시글 작성 시점
    postedAt: {
        type: String,
        required: true,
    },
    //좋아요 누른 사람 목록 (userId)
    liker: {
        type: [String],
        default: [],
    },
    //댓글 목록
    comment: {
        type: [
            {
                type: CommentType,
            },
        ],
        default: [],
    },
});

module.exports = mongoose.model('Post', postSchema);
