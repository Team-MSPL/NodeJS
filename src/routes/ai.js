const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const ManageUser = require('../schemas/manage_user.js');
var _ = require('./ai/local_search_ai.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const axios = require('axios');

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

        console.log('--- log start ---');

        let result = null;
        try {
            // ai 서버에 요청
            result = await axios({
                method: 'post',
                url: 'http://43.201.43.208:8081/ai/run',
                data: req.body,
            });

            res.json(result.data);
        } catch (e) {
            console.log(e);
            res.status(404).json({ status: 'failed', message: 'failed' });
        }
        console.log('--- log end ---');
    });
});

// 워커 스레드에서 작업 실행 함수 (비동기)
async function runWorkerThread(workerData) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./routes/ai/local_search_ai.js', { workerData });

        worker.on('message', (message) => {
            resolve(message);
        });

        worker.on('error', (error) => {
            console.error(error);
            reject(error);
        });
    });
}

module.exports = router;
