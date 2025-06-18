const express = require('express');
var { readOnePlace } = require('./firebase/firebase_read_place.js');
var { readOneRegion } = require('./firebase/firebase_read_region.js');
var { readOnePlaceInfo } = require('./firebase/firebase_read_place_info.js');
var { writeReviewOnPlace, deleteReviewOnPlace } = require('./firebase/firebase_write.js');
var { googleKeywordApi } = require('./google/google_place_api.js');
var { googleGeoApi } = require('./google/google_geo_place_api.js');
const RecommendPlace = require('../schemas/recommend_place.js');
const ManageTravel = require('../schemas/manage_travel.js');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가

// 여행지 정보 가져오기(파베 + 구글 Place API)
router.get('/placeInfo', async (req, res) => {
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
            const region = req.query.region;
            const name = req.query.name;
            const lat = req.query.lat;
            const lng = req.query.lng;
            const version = req.query.version || ''; // "startPoint" 로 오면 시작점인 공항, 역 탐색 - 다른방식으로 수정함 일단

            let result = await readOnePlaceInfo(region, name);

            //서울 전체로 쏘면, 도심권 등 5개 전부 탐색
            if (region === '서울 전체') {
                result = await readOnePlaceInfo('서울 도심권', name);
                if (!result) {
                    result = await readOnePlaceInfo('서울 동남권', name);
                }
                if (!result) {
                    result = await readOnePlaceInfo('서울 동북권', name);
                }
                if (!result) {
                    result = await readOnePlaceInfo('서울 서남권', name);
                }
                if (!result) {
                    result = await readOnePlaceInfo('서울 서북권', name);
                }
            }

            //파베에서 정상적으로 불러왔을 경우
            if (result) {
                return res.status(200).json(result);
            }
            //파베에서 정상적으로 불러오지 못 했을 경우 - 구글 Place API
            else {
                result = await googleKeywordApi({
                    region: region,
                    name: name,
                    lat: lat,
                    lng: lng,
                    version: version,
                });
                console.log(result);
                if (result.status === 'failed') {
                    return res.status(404).json({ message: '장소 정보가 없습니다.' });
                } else {
                    return res.status(201).json(result.data);
                }
            }
        } catch (error) {
            console.error('/place/placeInfo - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 관광지 리뷰 추가하기
router.patch('/savePlaceReview', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { region, name, reviewContent, reviewPhotoList, reviewUserToken, reviewId } = req.body; // reviewUserToken - 탈퇴 후 복귀하는 유저들 때문에 유저토큰 사용

            let result = await writeReviewOnPlace(region, name, {
                reviewContent: reviewContent,
                reviewUserToken: reviewUserToken,
                reviewPhotoList: reviewPhotoList,
                reviewId: reviewId,
            });

            // 몽고 DB에도 저장
            const newReview = new ManageTravel({
                userId: decoded._id,
                travelId: name,
                review: reviewContent,
                point: -1,
                tendencyPoint: [[]],
                region: region,
                day: [],
                nDay: -1,
                tendency: [[]],
                timetable: [[]],
                photoList: reviewPhotoList,
            });

            //DB에 저장
            await newReview.save();

            if (result.status === 'success') {
                return res.status(200).json({ message: '관광지 리뷰 추가 성공.' });
            }
            //업데이트 에러
            else if (result.status === 'update error') {
                return res.status(403).json({ message: '정보 업데이트가 실패하였습니다.' });
            }
            //장소 검색 에러
            else {
                return res.status(404).json({ message: '장소 정보가 없습니다.' });
            }
        });
    } catch (error) {
        console.error('/place/savePlaceReview - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 관광지 리뷰 삭제하기
router.patch('/deletePlaceReview', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { region, name, reviewId } = req.body;

            //240315 - reviewId 도입했으나, 이전에 남긴 리뷰들때문에 남겨둠
            let result = await deleteReviewOnPlace(region, name, reviewId);

            if (result.status === 'success') {
                return res.status(200).json({ message: '관광지 리뷰 삭제 성공.' });
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
                return res.status(404).json({ message: '장소 정보가 없습니다.' });
            }
        });
    } catch (error) {
        console.error('/place/deletePlaceReview - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 메인 화면 추천 관광지 리스트
router.get('/placeRecommendInMainScreen', async (req, res) => {
    //JWT 토큰 인증 X

    let placeList = [];

    try {
        //보여줄 관광지 리스트
        const targetPlaceList = await RecommendPlace.find({});

        for (const item of targetPlaceList) {
            let place = await readOnePlace(item.region, item.name);

            //대전 전체 등 "전체"라는 단어를 제거함
            place.region = item.region.replace(' 전체', '');

            placeList.push(place);
        }

        return res.status(200).json(placeList);
    } catch (error) {
        console.error('/place/placeRecommendInMainScreen - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 메인 화면 추천 관광지 리스트 세팅
router.patch('/setPlaceRecommendInMainScreen', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const { targetPlaceList } = req.body; // region, name을 가진 객체로 이루어진 리스트

        //기존 RecommendPlace는 모두 삭제
        try {
            // 모든 데이터 삭제
            const result = await RecommendPlace.deleteMany({});
            console.log(`삭제된 데이터 수: ${result.deletedCount}`);
        } catch (error) {
            console.error('데이터 삭제 중 오류 발생:', error);
        }

        //새로운 데이터로 업데이트
        for (const item of targetPlaceList) {
            await new RecommendPlace({
                region: item.region.trim(),
                name: item.name.trim(),
            }).save();
        }

        return res.status(200).json({ message: '추천 관광지 세팅 완료.' });
    } catch (error) {
        console.error('/place/setPlaceRecommendInMainScreen - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 여행 지역 정보
router.get('/regionInfo', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const region = req.query.region;
            let cleanedRegion = region.replace('전체', '').trim();

            // 해외가 포함되어 있을 경우, 지역 대분류를 앞에 추가해줘야함 - 간토 (Kanto) !도쿄

            let result = await readOneRegion(cleanedRegion);

            if (result != undefined && result != null) {
                return res.status(200).json(result);
            }
            //장소 검색 에러
            else {
                return res.status(404).json({ message: '여행 지역 정보가 없습니다.' });
            }
        });
    } catch (error) {
        console.error('/place/regionInfo - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 장소 위도 경도 확인
router.get('/placeGeoInfo', async (req, res) => {
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
            const region = req.query.region;
            const name = req.query.name;

            result = await googleGeoApi({
                name,
                region,
            });
            if (result.status === 'failed') {
                return res.status(404).json({ message: '장소 정보가 없습니다.' });
            } else {
                return res.status(201).json(result);
            }
        } catch (error) {
            console.error('/place/placeGeoInfo - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 장소 위도경도 확인 - 배열 처리 버전
router.post('/placeGeoInfoList', async (req, res) => {
    const token = req.header('Authorization').split(' ')[1];
    dotenv.config();

    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        try {
            const places = req.body.places;

            //console.log(places);

            if (!Array.isArray(places) || places.length === 0) {
                return res.status(400).json({ message: '유효한 장소 배열이 필요합니다.' });
            }

            // 병렬 API 호출
            const results = await Promise.all(places.map((place) => googleGeoApi(place)));

            return res.status(200).json({ results });
        } catch (error) {
            console.error('/place/placeGeoInfoList - POST 오류:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

module.exports = router;
