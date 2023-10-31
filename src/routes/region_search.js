const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const ManageUser = require('../schemas/manage_user.js');
var _ = require('./region_search/region_search_algorithm.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// 여행 지역 추천
router.post('/run', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출
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
            const { selectList, selectPopular, recentPosition, distanceSensitivity } = req.body;

            console.log('--- log start ---');

            let version;

            if (req.body.hasOwnProperty('version')) {
                // 특정 변수가 존재하면 해당 값을 사용
                version = req.body.version;
                console.log('version ', version);
            } else {
                // 특정 변수가 존재하지 않으면 기본값 사용 : version = 1
                version = 1;
                console.log('version ', version);
            }

            // 파싱된 데이터를 이용하여 처리 로직 수행

            // 요청을 처리할 워커 스레드 생성
            //./region_search/region_search_algorithm.js
            const worker = new Worker(
                '/home/ubuntu/danim_database/src/routes/region_search/region_search_algorithm.js',
                {
                    workerData: {
                        selectList: selectList,
                        selectPopular: selectPopular,
                        recentPosition: recentPosition,
                        distanceSensitivity: distanceSensitivity,
                        version: version,
                    },
                }
            );

            // 워커 스레드가 완료되면 응답을 클라이언트에 보냅니다.
            worker.on('message', (message) => {
                //res.json({ message: 'API 요청 처리 완료', data: message });

                console.log('--- log end ---');
                res.json(message.result);
            });

            // 에러 처리
            worker.on('error', (error) => {
                console.error(error);
                res.status(500).json({ error: 'Internal server error' });
            });

            // const resultData = await regionSearch({
            //     selectList: selectList,
            //     selectPopular: selectPopular,
            //     recentPosition: recentPosition,
            //     distanceSensitivity: distanceSensitivity,
            // });
        } catch (error) {
            console.error('/regionSearch/run - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});
module.exports = router;
