const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const ManageUser = require('../schemas/manage_user.js');
var _ = require('./ai/local_search_ai.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

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

        //manage_user에 호출 횟수 추가
        await ManageUser.findOne({ userId: decoded._id.toString() })
            .then(async (user) => {
                if (!user) {
                    console.log(user);
                    res.status(401).json({ message: 'Unauthorized' });
                }
                user.useTokenTime += 1;

                await user.save();
            })
            .catch((error) => {
                console.error('ManageUser.findOne() 함수에 문제 발생 : ', error);
                res.status(401).json({ message: 'Unauthorized' });
            });

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

            // 요청을 처리할 워커 스레드 생성
            const worker = new Worker('./routes/ai/local_search_ai.js', {
                workerData: {
                    regionList: regionList,
                    accomodationList: accomodationList,
                    selectList: selectList,
                    essentialPlaceList: essentialPlaceList,
                    timeLimitArray: timeLimitArray,
                    nDay: nDay,
                    transit: transit,
                    distanceSensitivity: distanceSensitivity,
                },
            });

            // 워커 스레드가 완료되면 응답을 클라이언트에 보냅니다.
            worker.on('message', (message) => {
                //res.json({ message: 'API 요청 처리 완료', data: message });

                console.log('--- log end ---');

                res.json({ status: 'success', data: message });
            });

            // 에러 처리
            worker.on('error', (error) => {
                console.error(error);
                res.status(500).json({ error: 'Internal server error' });
            });
        } catch (error) {
            console.error('/ai/run - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

module.exports = router;
