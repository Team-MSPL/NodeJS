const mongoose = require('mongoose');

const { Schema } = mongoose;

const inquirySchema = new Schema({
    //문의한유저 ID
    userId: {
        type: String,
        required: true,
    },
    //문의한유저 이름
    userName: {
        type: String,
        default: '',
    },
    //문의 내역
    inquiryContent: {
        type: String,
        default: '',
    },
});

module.exports = mongoose.model('Inquiry', inquirySchema);
