const express = require('express');
const router = express.Router();
const Inquiry = require('../schemas/inquiry.js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

var _ = require('lodash');

// 문의하기
router.post('/inquiry', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    //dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            const { userName, inquiryContent } = req.body;

            const newInquiry = new Inquiry({
                userId: decoded._id,
                userName: userName,
                inquiryContent: inquiryContent,
            });

            //DB에 저장
            await newInquiry.save();

            res.status(201).json({ message: '문의 완료.' });
        } catch (error) {
            console.error('/inquiry/inquiry - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

module.exports = router;
