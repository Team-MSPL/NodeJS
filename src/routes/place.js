const express = require('express');
var { readOnePlaceInfo } = require('./firebase/firebase_read_place_info.js');
var { writeReviewOnPlace, deleteReviewOnPlace } = require('./firebase/firebase_write.js');
var { googleKeywordApi } = require('./firebase/google_place_api.js');
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

            let result = await readOnePlaceInfo(region, name);

            //파베에서 정상적으로 불러왔을 경우
            if (result) {
                return res.status(200).json(result);
            }
            //파베에서 정상적으로 불러오지 못 했을 경우 - 구글 Place API
            else {
                result = await googleKeywordApi({
                    name: name,
                    lat: lat,
                    lng: lng,
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

            const { region, name, reviewContent, reviewPhotoList, reviewUserToken } = req.body; // reviewUserToken - 탈퇴 후 복귀하는 유저들 때문에 유저토큰 사용

            let result = await writeReviewOnPlace(region, name, {
                reviewContent: reviewContent,
                reviewUserToken: reviewUserToken,
                reviewPhotoList: reviewPhotoList,
            });
            console.log(result);

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

            const { region, name, reviewContent, reviewPhotoList, reviewUserToken } = req.body; // reviewUserToken - 탈퇴 후 복귀하는 유저들 때문에 유저토큰 사용

            let result = await deleteReviewOnPlace(region, name, {
                reviewContent: reviewContent,
                reviewPhotoList: reviewPhotoList,
                reviewUserToken: reviewUserToken,
            });

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

module.exports = router;
