const mongoose = require('mongoose');

const { Schema } = mongoose;

const eventSchema = new Schema({
    //이벤트 사진리스트
    eventImage: {
        type: [String],
        default: [],
        required: true,
    },
    //이벤트 종료 시점
    eventEndDate: {
        type: Date,
        required: true,
    },
});

module.exports = mongoose.model('Event', eventSchema);
