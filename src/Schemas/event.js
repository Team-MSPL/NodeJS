const mongoose = require('mongoose');

const { Schema } = mongoose;

const eventSchema = new Schema({
    //이벤트 사진
    eventImage: {
        type: String,
        default: '',
        required: true,
    },
    //이벤트 종료 시점
    eventEndDate: {
        type: Date,
        required: true,
    },
    //이벤트 링크
    eventLink: {
        type: String,
        default: '',
    },
});

module.exports = mongoose.model('Event', eventSchema);
