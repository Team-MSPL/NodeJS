const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const HikingSearchLog = require('../schemas/hiking_search_log.js');
var { writeReviewOnHiking, deleteReviewOnHiking } = require('./firebase/firebase_write.js');
var _ = require('./hiking_search/hiking_search_algorithm.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// 탐방 코스 추천
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
            const { mountainName, selectList, selectDifficulty } = req.body;

            console.log('--- log start ---');

            const version = req.body.hasOwnProperty('version') ? req.body.version : 1;

            // 파싱된 데이터를 이용하여 처리 로직 수행

            // 요청을 처리할 워커 스레드 생성
            const worker = new Worker(
                '/home/ubuntu/danim_database/src/routes/hiking_search/hiking_search_algorithm.js',
                {
                    workerData: {
                        mountainName: mountainName,
                        selectList: selectList,
                        selectDifficulty: selectDifficulty,
                        version: version,
                    },
                }
            );

            // 워커 스레드가 완료되면 응답을 클라이언트에 보냅니다.
            worker.on('message', async (message) => {
                //res.json({ message: 'API 요청 처리 완료', data: message });

                console.log('--- log end ---');

                if (message.result.length === 0) {
                    res.status(405).json({
                        error: '추천드릴 수 있는 탐방 코스가 없습니다. 난이도와 성향을 재설정 후, 다시 시도해주세요.',
                    });
                } else {
                    await countLog(decoded, selectList, selectDifficulty);
                    res.json(message.result);
                }
            });

            // 에러 처리
            worker.on('error', (error) => {
                console.error(error);
                res.status(500).json({ error: 'Internal server error' });
            });
        } catch (error) {
            console.error('/hikingSearch/run - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

async function countLog(decoded, selectList, selectDifficulty) {
    const newHikingSearchLog = new HikingSearchLog({
        userId: decoded._id.toString(),
        selectList: selectList,
        selectPopular: selectDifficulty,
    });
    await newHikingSearchLog.save();
}

// 탐방 코스 리뷰 추가하기
router.patch('/saveReview', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { region, name, reviewContent, reviewPhotoList, reviewUserToken } = req.body; // reviewUserToken - 탈퇴 후 복귀하는 유저들 때문에 유저토큰 사용

            let result = await writeReviewOnHiking(region, name, {
                reviewContent: reviewContent,
                reviewUserToken: reviewUserToken,
                reviewPhotoList: reviewPhotoList,
            });
            console.log(result);

            if (result.status === 'success') {
                return res.status(200).json({ message: '탐방 코스 리뷰 추가 성공.' });
            }
            //업데이트 에러
            else if (result.status === 'update error') {
                return res.status(403).json({ message: '정보 업데이트가 실패하였습니다.' });
            }
            //장소 검색 에러
            else {
                return res.status(404).json({ message: '탐방 코스 정보가 없습니다.' });
            }
        });
    } catch (error) {
        console.error('/hikingSearch/saveReview - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 탐방 코스 리뷰 삭제하기
router.patch('/deleteReview', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { region, name, reviewContent, reviewPhotoList, reviewUserToken } = req.body; // reviewUserToken - 탈퇴 후 복귀하는 유저들 때문에 유저토큰 사용

            let result = await deleteReviewOnHiking(region, name, {
                reviewContent: reviewContent,
                reviewPhotoList: reviewPhotoList,
                reviewUserToken: reviewUserToken,
            });

            if (result.status === 'success') {
                return res.status(200).json({ message: '탐방 코스 리뷰 삭제 성공.' });
            }
            //리뷰가 없을 경우 에러
            else if (result.status === 'no data') {
                return res.status(402).json({ message: '기존에 저장되어 있던 리뷰가 없습니다.' });
            }
            //업데이트 에러
            else if (result.status === 'update error') {
                return res.status(403).json({ message: '정보 업데이트가 실패하였습니다.' });
            }
            //장소 검색 에러
            else {
                return res.status(404).json({ message: '탐방 코스 정보가 없습니다.' });
            }
        });
    } catch (error) {
        console.error('/hikingSearch/deleteReview - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
module.exports = router;
