const mongoose = require('mongoose');

const { Schema } = mongoose;

const recommendPlaceSchema = new Schema({
    //이름
    name: {
        type: String, // 자료형
    },
    //지역
    region: {
        type: String,
    },
});

module.exports = mongoose.model('RecommendPlace', recommendPlaceSchema);
