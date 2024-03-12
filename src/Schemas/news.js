const mongoose = require('mongoose');

const { Schema } = mongoose;

const newsSchema = new Schema({
    //뉴스 제목
    newsTitle: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //뉴스 내용
    newsContent: {
        type: String,
        required: true,
    },
    //뉴스 사진
    newsImage: {
        type: [String],
        default: [],
    },
    //뉴스 작성 시점
    newsDate: {
        type: Date,
    },
    //뉴스 링크 ( 추후 바뀔 수도 있으니, 배열로 했음 )
    newsLink: {
        type: [String],
        default: [],
        required: true,
    },
});

module.exports = mongoose.model('News', newsSchema);
