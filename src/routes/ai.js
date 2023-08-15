const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
var { localSearchAI } = require('./ai/local_search_ai.js');

// 여행 코스 추천
router.post('/run', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출

    // 요청에 대한 타임아웃을 80초로 설정
    req.setTimeout(80000); // 80초 = 80,000밀리초

    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        try {
            // 클라이언트로부터 전달된 JSON 데이터
            const {
                regionList,
                accomodationList,
                selectList,
                essentialPlaceList,
                timeLimitArray,
                nDay,
                transit,
                distanceSensitivity,
            } = req.body;

            // const requestData = req.query.data;
            // // JSON 데이터 파싱
            // const jsonData = JSON.parse(requestData);

            // 파싱된 데이터를 이용하여 처리 로직 수행

            console.log('--- log start ---');

            const resultData = await localSearchAI({
                regionList: regionList,
                accomodationList: accomodationList,
                selectList: selectList,
                essentialPlaceList: essentialPlaceList,
                timeLimitArray: timeLimitArray,
                nDay: nDay,
                transit: transit,
                distanceSensitivity: distanceSensitivity,
            });
            console.log('--- log end ---');

            res.json({ status: 'success', data: resultData });
        } catch (error) {
            console.error('/ai/run - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

module.exports = router;
