const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const ManageUser = require('../schemas/manage_user.js');
const RegionSearchLog = require('../schemas/region_search_log.js');
const { regionSearch } = require('./region_search/region_search_algorithm.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
var { readAllRegion } = require('./firebase/firebase_read_region.js');
var { readAllPlace } = require('./firebase/firebase_read_place.js');
const { log } = require('console');

//Step 1. Data Loading
async function dataLoading(version) {
    let regionList = []; // reset the list

    let collectionName;

    if (version === 1) {
        collectionName = '전국 여행 지역';
    } else {
        collectionName = '전국 여행 지역 ver2';
    }

    await readAllRegion(collectionName)
        .then((res) => {
            regionList = [...regionList, ...res];
            //regionListCopy = [...regionListCopy, ...res];
        })
        .catch((err) => {
            console.log(err);
        });

    return regionList;
}

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

            //시간 재기
            const startTime = performance.now();

            console.log(req);
            console.log(req.body);
            console.log(selectList);
            console.log(selectPopular);
            console.log(recentPosition);
            console.log(distanceSensitivity);
            console.log('--- log start ---');

            const version = req.body.hasOwnProperty('version') ? req.body.version : 1;

            // 파싱된 데이터를 이용하여 처리 로직 수행

            // 요청을 처리할 워커 스레드 생성
            //./region_search/region_search_algorithm.js
            // const worker = new Worker(

            //데이터 로딩
            let regionList = await dataLoading(version);

            result_search = regionSearch(
                selectList,
                selectPopular,
                distanceSensitivity,
                recentPosition,
                version,
                regionList
            );

            let result = await Promise.all(
                result_search.map(async (region) => {
                    // 각 지역에 대해 관광지 리스트를 불러오는 Promise 배열 생성
                    let placePromises = region.cityList.map(async (city, idx) => {
                        try {
                            return await readAllPlace(city, false, idx);
                        } catch (err) {
                            console.error(err);
                            return [];
                        }
                    });

                    // 모든 도시에서의 관광지 데이터를 병렬로 가져오기
                    let places = await Promise.all(placePromises);
                    let placeListInTopRankRegion = places.flat();

                    // 인기 순으로 정렬
                    placeListInTopRankRegion.sort((a, b) => b.popular - a.popular);

                    // 인기 상위 5개 관광지 골라내기
                    let topPopularPlaceList = placeListInTopRankRegion.slice(0, 5).map((place) => ({
                        name: place.name,
                        photo: place.photo,
                        lat: place.lat,
                        lng: place.lng,
                    }));

                    return {
                        name: region.name,
                        takenDay: region.takenDay,
                        photo: region.photo,
                        tendency: region.tendency,
                        topPopularPlaceList: topPopularPlaceList,
                    };
                })
            );
            //시간 재기
            const endTime = performance.now();

            for (let i = 0; i < result.length; i++) {
                console.log(result[i].name);
            }

            console.log(`알고리즘 돌리는데 걸리는 시간`);

            const elapsedTime = endTime - startTime;

            console.log(`Elapsed time: ${elapsedTime / 1000} seconds`);
            console.log(`------------------------------------------`);

            res.json(result);
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
