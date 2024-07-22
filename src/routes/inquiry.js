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
            const { userName, inquiry } = req.body;

            const newInquiry = new Inquiry({
                userId: decoded._id,
                userName: userName,
                inquiryContent: inquiry,
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

// 문의 전체 조회
router.get('/all', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        // JWT 토큰 검증 성공 시 요청 처리
        // 모든 문의를 조회
        const allInquiries = await Inquiry.find({});

        res.status(200).json(allInquiries);
    } catch (error) {
        console.error('/inquiry/all - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
