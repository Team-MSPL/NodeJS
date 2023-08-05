const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const TravelCourse = require('../schemas/travel_course.js');
const dotenv = require('dotenv');

// 1. 여행 코스 목록 가져오기 ( 메인 화면 + 내 여행 목록 )
router.get('/travelList', async (req, res) => {
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
        try {
            const { userId } = req.body;

            //여러개를 찾아, List로 묶어서 주는 함수 - find!

            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            TravelCourse.find({ userId })
                .select('region day nDay')
                .then((travelCourseList) => {
                    if (!travelCourseList || travelCourseList.length == 0) {
                        return res.status(404).json({ message: '저장된 여행이 없습니다.' });
                    }

                    res.status(201).json({
                        travelCourseList: travelCourseList,
                    });
                })
                .catch((error) => {
                    console.error('TravelCourse.find() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 userId 입니다.' });
                });
        } catch (error) {
            console.error('/users - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 2. 여행 코스 하나 가져오기
router.get('/getOneTravelCourse', async (req, res) => {
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            const { travelId } = req.body;

            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            TravelCourse.findOne({ _id: travelId }) //travelId를 저장해둔 것이 아니라, _id를 찾는거임
                .select('region day nDay transit timetable')
                .then((travelCourse) => {
                    if (!travelCourse) {
                        console.log(travelCourse);
                        return res.status(404).json({ message: '저장된 여행이 없습니다.' });
                    }

                    res.status(201).json({
                        travelCourse: travelCourse,
                    });
                })
                .catch((error) => {
                    console.error('TravelCourse.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 travelId 입니다.' });
                });
        } catch (error) {
            console.error('/users - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 4. 여행 코스 저장하기
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

module.exports = router;
