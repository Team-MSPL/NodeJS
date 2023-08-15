const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
var { regionSearch } = require('./region_search/region_search_algorithm.js');

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
            // JSON 데이터 파싱
            //const jsonData = JSON.parse(requestData);

            // 파싱된 데이터를 이용하여 처리 로직 수행

            console.log('--- log start ---');

            const resultData = await regionSearch({
                selectList: selectList,
                selectPopular: selectPopular,
                recentPosition: recentPosition,
                distanceSensitivity: distanceSensitivity,
            });

            console.log('--- log end ---');

            res.json(resultData);
        } catch (error) {
            console.error('/regionSearch/run - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});
module.exports = router;
