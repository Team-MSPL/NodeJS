const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const ManageUser = require('../schemas/manage_user.js');
const RecommendPlace = require('../schemas/recommend_place.js');
const AI = require('../schemas/ai.js');
const AIRecommendPlaceLog = require('../schemas/ai_recommend_place_log.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const axios = require('axios');
const mongoose = require('mongoose');

const url_v2 = 'http://3.37.228.174/ai/run';

// 여행 코스 추천
router.post('/run', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출

    // 요청에 대한 타임아웃을 80초로 설정
    req.setTimeout(80000); // 80초 = 80,000밀리초

    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    dotenv.config(); // .env 파일의 환경 변수 로드

    const freeTicket = req.body.hasOwnProperty('freeTicket') ? req.body.freeTicket : false;

    const version = req.body.hasOwnProperty('version') ? req.body.version : 1;

    let url = '';

    url = url_v2;

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //freeTicket이 false면 로그를 남김
        if (!freeTicket) {
            //manage_user에 호출 횟수 추가
            await ManageUser.findOne({ userId: decoded._id.toString() })
                .then(async (user) => {
                    if (!user) {
                        console.log(user);
                        res.status(401).json({ message: 'Unauthorized' });
                        return;
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
                        tokenLogContent: '여행 코스 추천 기능 사용',
                        tokenLogNumber: -1,
                        tokenLogDate: now.getTime(),
                    });

                    await user.save();
                })
                .catch((error) => {
                    console.error('ManageUser.findOne() 함수에 문제 발생 : ', error);
                    res.status(401).json({ message: 'Unauthorized' });
                    return;
                });
        }

        console.log('--- log start ---');

        let result = null;

        //240223 - 필수여행지에 regionIndex를 찾아 넣어줌 ( 클라이언트에서 region값은 주는 거로 수정함 )
        const { regionList, essentialPlaceList } = req.body;

        essentialPlaceList.length > 0 &&
            essentialPlaceList.map((item, idx) => {
                //regionList와 일치하는 경우 탐색
                for (let i = 0; i < regionList.length; i++) {
                    if ((item.region ?? false) && item.region === regionList[i]) {
                        //인덱스번호를 찾아 regionIndex로 넣음. 없으면 안넣고 감
                        item.regionIndex = i;
                        break;
                    }
                }
            });

        try {
            // ai 서버에 요청
            result = await axios({
                method: 'post',
                url: url,
                data: req.body,
            });
            if (result.data.hasOwnProperty('resultData')) {
                res.json({ status: 'success', data: result.data });
            } else {
                res.json({ status: 'failed', message: 'failed' });
            }
            console.log('--- log end ---');
            return;
        } catch (e) {
            console.log(e);
            res.json({ status: 'failed', message: 'failed' });
            console.log('--- log end ---');
            return;
        }
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

// 여행 추천 장소 리스트
router.post('/recommendPlace', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출

    let url_recommend_place = 'http://3.37.228.174/ai/recommendPlace';

    console.log('--- log start - recommendPlace ---');

    let result = null;

    let regionList = req.body.regionList;

    if (Array.isArray(regionList) && regionList.length > 0) {
        if (regionList[0] === '서울 전체') {
            regionList = ['서울 도심권', '서울 동북권', '서울 동남권', '서울 서북권', '서울 서남권'];
        } else if (regionList[0] === '제주 전체') {
            regionList = ['제주 제주시', '제주 서귀포시'];
        }
    } else {
        // 예외 처리: regionList가 없을 경우 기본값 설정 또는 에러 응답
        return res.status(400).json({
            status: 'failed',
            message: 'regionList가 누락되었습니다.',
        });
    }

    // 로그 남겨두기
    try {
        const newAIRecommendPlaceLog = new AIRecommendPlaceLog({
            userId: req.body.hasOwnProperty('userId') ? req.body.userId : 'unknown',
            region: regionList,
            transit: req.body.transit,
            tendency: req.body.selectList,
            distanceSensitivity: req.body.distanceSensitivity,
            bandwidth: req.body.bandwidth,
            lat: req.body.lat,
            lng: req.body.lng,
            password: req.body.password,
        });
        await newAIRecommendPlaceLog.save();
        console.log('로그 기록 완료');
    } catch (e) {
        console.log(e);
        console.log('AI 장소 추천 로그 기록 중 에러 발생');
    }

    try {
        // ai 서버에 요청
        result = await axios({
            method: 'post',
            url: url_recommend_place,
            data: req.body,
        });
        res.json(result.data);
        console.log('--- log end - recommendPlace ---');
        return;
    } catch (e) {
        console.log(e);
        res.json({ status: 'failed', message: 'failed' });
        console.log('--- log end - recommendPlace ---');
        return;
    }
});

// AI 결과 목록 불러오기
router.get('/aiList', async (req, res) => {
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            AI.find({ userId: decoded._id })
                .sort({ 'day.0': -1 }) // day 배열의 첫 번째 원소값을 기준으로 내림차순 정렬
                .then((aiResultList) => {
                    if (!aiResultList) {
                        return res.status(404).json({ message: '해당 유저 ID에 대한 AI 결과를 찾을 수 없습니다.' });
                    } else if (aiResultList.length === 0) {
                        return res.status(202).json(aiResultList);
                    }

                    res.status(201).json(aiResultList);
                })
                .catch((error) => {
                    console.error('AI.find() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 userId 입니다.' });
                });
        } catch (error) {
            console.error('/AI - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// AI 결과 임시 저장해두기
router.post('/saveAI', async (req, res) => {
    try {
        // 클라이언트에서 전달한 JWT 토큰 추출
        const token = req.header('Authorization').split(' ')[1];

        // JWT 토큰 검증
        dotenv.config(); // .env 파일의 환경 변수 로드

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const {
                travelName,
                region,
                tendency,
                timeLimitArray,
                nDay,
                day,
                transit,
                preset,
                enoughPlace,
                bestPointList,
            } = req.body;

            let presetCopy = preset.map((item, index) =>
                item.map((value, idx) => value.map(({ id, key, ...rest }) => rest))
            );
            const newAI = new AI({
                userId: decoded._id,
                travelName: travelName,
                region: region,
                tendency: tendency,
                timeLimitArray: timeLimitArray,
                nDay: nDay,
                day: day,
                transit: transit,
                preset: presetCopy,
                enoughPlace: enoughPlace,
                bestPointList: bestPointList,
            });
            // 저장 시점 직전에만 로그 비활성화 - 로그가 너무 김
            mongoose.set('debug', false);
            try {
                const savedAI = await newAI.save();
                res.status(201).json({ aiId: savedAI._id });
            } finally {
                mongoose.set('debug', true);
            }
        });
    } catch (error) {
        //console.error('/AI/saveAI - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// AI 결과 삭제하기
router.delete('/deleteAI', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { aiId } = req.body;

            // Delete the travel course
            AI.findOneAndDelete({ _id: aiId })
                .then((deletedAI) => {
                    if (!deletedAI) {
                        return res.status(404).json({ message: '삭제할 AI 결과를 찾을 수 없습니다.' });
                    }

                    res.status(200).json({ message: 'AI 결과 삭제 완료.' });
                })
                .catch((error) => {
                    console.error('AI.findOneAndDelete() 함수에 문제 발생 : ', error);
                    res.status(500).json({ message: '서버 내부 오류 발생' });
                });
        });
    } catch (error) {
        console.error('/AI/deleteAI - DELETE 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
