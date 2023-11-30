const mongoose = require('mongoose');

const { Schema } = mongoose;

const noticeSchema = new Schema({
    //공지사항 제목
    noticeTitle: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //공지사항 내용
    noticeContent: {
        type: String,
        required: true,
    },
    //공지사항 사진리스트
    noticeImage: {
        type: [String],
        default: [],
    },
    //공지사항 작성 시점
    noticedAt: {
        type: Date,
        required: true,
    },
});

module.exports = mongoose.model('Notice', noticeSchema);
