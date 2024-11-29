const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const ManageUser = require('../schemas/manage_user.js');
const RegionSearchLog = require('../schemas/region_search_log.js');
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

        try {
            const { selectList, selectPopular, recentPosition, distanceSensitivity } = req.body;

            const country = req.body.hasOwnProperty('country') ? req.body.country : 'korea';

            const version = req.body.hasOwnProperty('version') ? req.body.version : 1;

            console.log('--- log start ---');

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
                        country: country,
                    },
                }
            );

            // 워커 스레드가 완료되면 응답을 클라이언트에 보냅니다.
            worker.on('message', async (message) => {
                //res.json({ message: 'API 요청 처리 완료', data: message });

                console.log('--- log end ---');

                if (message.result.length === 0) {
                    res.status(405).json({
                        error: '추천드릴 수 있는 지역이 없습니다. 지역의 인기도와 여행 반경을 재설정 후, 다시 시도해주세요.',
                    });
                } else {
                    await countLog(decoded, selectList, selectPopular, recentPosition, distanceSensitivity, country);
                    res.json(message.result);
                }
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

async function countLog(decoded, selectList, selectPopular, recentPosition, distanceSensitivity) {
    await ManageUser.findOne({ userId: decoded._id.toString() })
        .then(async (user) => {
            if (!user) {
                console.log(user);
                res.status(401).json({ message: 'Unauthorized' });
            }
            user.useTokenTime += 1;

            const now = new Date(); // 현재 날짜 및 시간
            const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
            const koreaTimeDiff = 9 * 60 * 60 * 1000;
            const korNow = new Date(utc + koreaTimeDiff);

            if (!user.tokenLog) {
                user.tokenLog = [];
            }
            user.tokenLog.push({
                tokenLogContent: '여행 지역 추천 기능 사용',
                tokenLogNumber: -1,
                tokenLogDate: now.getTime(),
            });

            await user.save();
        })
        .catch((error) => {
            console.error('ManageUser.findOne() 함수에 문제 발생 : ', error);
            res.status(401).json({ message: 'Unauthorized' });
        });

    // RegionSearchLog 객체도 생성
    const newRegionSearchLog = new RegionSearchLog({
        userId: decoded._id.toString(),
        selectList: selectList,
        selectPopular: selectPopular,
        recentPosition: recentPosition,
        distanceSensitivity: distanceSensitivity,
    });
    await newRegionSearchLog.save();
}
module.exports = router;
