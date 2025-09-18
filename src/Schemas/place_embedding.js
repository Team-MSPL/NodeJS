const mongoose = require('mongoose');

const { Schema } = mongoose;

const placeEmbeddingSchema = new Schema({
    //이름
    place: {
        type: String, // 자료형
    },
    //국가
    country: {
        type: String,
    },
    //지역
    region: {
        type: String,
    },
    //임베딩
    embedding: {
        type: [Number],
    },
});

module.exports = mongoose.model('PlaceEmbedding', placeEmbeddingSchema);
