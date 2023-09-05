const mongoose = require('mongoose');

const { Schema } = mongoose;

const marketingSchema = new Schema({
    //이름
    name: {
        type: String, // 자료형
        required: true, // 필수 여부
    },
    //전화번호
    phoneNum: {
        type: String,
        default: '',
    },
    //이메일
    email: {
        type: String,
        default: '',
    },
    provider: {
        type: String,
        default: '',
    },
});

module.exports = mongoose.model('Marketing', marketingSchema);
