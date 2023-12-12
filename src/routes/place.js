const express = require('express');
var { readOnePlaceInfo } = require('./firebase/firebase_read_place_info.js');
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

            let result = readOnePlaceInfo(region, name);

            //파베에서 정상적으로 불러왔을 경우
            if (result) {
                return res.status(200).json(result);
            }
            //파베에서 정상적으로 불러오지 못 했을 경우 - 구글 Place API
            else {
                result = googleKeywordApi({
                    name: name,
                    lat: lat,
                    lng: lng,
                });
                if (result.status === 'failed') {
                    return res.status(401).json({ message: '장소 정보가 없습니다.' });
                } else {
                    return res.status(201).json(result);
                }
            }
        } catch (error) {
            console.error('/place/placeInfo - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

module.exports = router;
