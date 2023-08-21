const mongoose = require('mongoose');
const User = require('../schemas/user.js');

const { Schema } = mongoose;

const manageUserSchema = new Schema({
    //토큰사용자 (userId)
    userId: {
        type: String,
        required: true,
    },
    //토큰 사용 횟수
    useTokenTime: {
        type: Number,
        default: 0,
    },
});

module.exports = mongoose.model('ManageUser', manageUserSchema);
