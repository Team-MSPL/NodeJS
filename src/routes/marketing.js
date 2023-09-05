const express = require('express');
const router = express.Router();
const Marketing = require('../schemas/marketing.js');
var _ = require('lodash');
require('dotenv').config();

// 웹 - 마케팅 정보 수집
// if (디비에있으면 ) 클라에 정보주기 esle if (없으면 ) 회원가입진행 else if(회원가입플래그면) 저장하고 로그인
router.post('/saveMarketing', async (req, res) => {
    try {
        const { name, phoneNum, email, provider } = req.body;

        if (provider === 'phoneNum') {
            const existingPhoneMarketing = await Marketing.findOne({ phoneNum: phoneNum });
            if (existingPhoneMarketing) {
                res.status(405).json({ message: '이미 존재하는 마케팅 정보입니다.' });
            } else {
                const newMarketing = new Marketing({
                    name: name,
                    phoneNum: phoneNum,
                    provider: provider,
                });
                await newMarketing.save();
                res.status(201).json({ message: '마케팅 정보 저장 완료.' });
            }
        } else if (provider === 'email') {
            const existingEmailMarketing = await Marketing.findOne({ email: email });
            if (existingEmailMarketing) {
                res.status(405).json({ message: '이미 존재하는 마케팅 정보입니다.' });
            } else {
                const newMarketing = new Marketing({
                    name: name,
                    email: email,
                    provider: provider,
                });
                await newMarketing.save();
                res.status(201).json({ message: '마케팅 정보 저장 완료.' });
            }
        } else {
            res.status(403).json({ message: 'provider가 잘못되었습니다.' });
        }
    } catch (error) {
        console.log(req.body);
        console.error('/users - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
