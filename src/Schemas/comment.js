const mongoose = require('mongoose');

const { Schema } = mongoose;
/**
 * 작성자, 댓글내용, 생성일 - 나중에 여행코스로 바꿀 예정
 */
//const { Types: ObjectId } = Schema;  //이건 왜 안되는지 모르겠음
const commentSchema = new Schema({
    commenter: {
        type: Schema.ObjectId,
        required: true,
        ref: 'User', // User Schema의 아이디
    },
    comment: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Comment', commentSchema);
