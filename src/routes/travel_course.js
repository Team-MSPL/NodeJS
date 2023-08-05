const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const TravelCourse = require('../schemas/travel_course.js');
const dotenv = require('dotenv');

// 여행 코스 저장
router.post('/save', async (req, res) => {
    try {
        // 클라이언트에서 전달한 JWT 토큰 추출
        const token = req.header('Authorization').split(' ')[1];

        // JWT 토큰 검증
        dotenv.config(); // .env 파일의 환경 변수 로드

        jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // JWT 토큰 검증 성공 시 요청 처리

            const { userId, region, day, nDay, transit, tendency, timetable } = req.body;

            const newTravelCourse = new TravelCourse({
                userId,
                region,
                day,
                nDay,
                transit,
                tendency,
                timetable,
            });

            const savedTravelCourse = await newTravelCourse.save();

            res.status(201).json({
                travelId: savedTravelCourse._id.toString(),
            });
        });
    } catch (error) {
        console.error('/users - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 여행 코스 목록 가져오기 ( 메인 화면 + 내 여행 목록 )
router.get('/travelList', async (req, res) => {
    try {
        // 클라이언트에서 전달한 JWT 토큰 추출
        const token = req.header('Authorization').split(' ')[1];

        // JWT 토큰 검증
        dotenv.config(); // .env 파일의 환경 변수 로드

        jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // JWT 토큰 검증 성공 시 요청 처리

            const { userId } = req.body;

            const travelCourseList = await TravelCourse.find({ userId }).select('region day nDay');

            if (!travelCourseList || travelCourseList.length == 0) {
                return res.status(404).json({ message: '저장된 여행이 없습니다.' });
            }

            res.status(201).json({
                travelCourseList: travelCourseList,
            });
        });
    } catch (error) {
        console.error('/users - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
