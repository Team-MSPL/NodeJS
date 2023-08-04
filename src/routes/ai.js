const express = require('express');
const router = express.Router();
var { localSearchAI, enoughPlace } = require('./ai/local_search_ai.js');

// 여행 지역 추천

router.get('/', async (req, res) => {
    // 클라이언트로부터 전달된 JSON 데이터
    const requestData = req.query.data;

    try {
        // JSON 데이터 파싱
        const jsonData = JSON.parse(requestData);

        // 파싱된 데이터를 이용하여 처리 로직 수행

        console.log('--- log start ---');

        const resultData = await localSearchAI({
            regionList: jsonData['regionList'],
            accomodationList: jsonData['accomodationList'],
            selectList: jsonData['selectList'],
            essentialPlaceList: jsonData['essentialPlaceList'],
            timeLimitArray: jsonData['timeLimitArray'],
            nDay: jsonData['nDay'],
            transit: jsonData['transit'],
            distanceSensitivity: jsonData['distanceSensitivity'],
        });
        console.log('--- log end ---');

        // 이 예제에서는 그대로 JSON 데이터를 응답으로 보내줍니다.
        res.json({ success: true, resultData: resultData, enoughPlace: enoughPlace });
    } catch (error) {
        // JSON 파싱 에러 처리
        res.status(400).json({ success: false, error: 'Invalid JSON data' });
    }
});

module.exports = router;
