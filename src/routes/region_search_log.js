const express = require('express');
const router = express.Router();
const RegionSearchLog = require('../schemas/region_search_log.js');
require('dotenv').config();

var _ = require('lodash');

// 지역 추천 로그 전체 조회
router.get('/all', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const allRegionSearchLog = await RegionSearchLog.find({});

        res.status(200).json(allRegionSearchLog);
    } catch (error) {
        console.error('/RegionSearchLog/all - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//인기도 선택 분포도 조회
router.get('/popularDistribution', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        RegionSearchLog.find({}, 'selectPopular')
            .then((logs) => {
                const processedLogs = logs.map((log) => {
                    // Check if [0] and [1] are the same, if so, remove [1]
                    if (log.selectPopular[0] === log.selectPopular[1]) {
                        log.selectPopular.splice(1, 1);
                    }

                    // Fill in values between [0] and [1]
                    const [min, max] = log.selectPopular;
                    const step = (max - min) / 20;
                    for (let i = 1; i < step; i++) {
                        log.selectPopular.splice(i, 0, min + i * 20);
                    }

                    return log;
                });

                const flattenedArray = processedLogs.flatMap((log) => log.selectPopular);
                const counts = {};

                flattenedArray.forEach((value) => {
                    counts[value] = (counts[value] || 0) + 1;
                });

                const result = Object.entries(counts).map(([value, count]) => ({
                    value: parseInt(value),
                    count,
                }));

                res.status(200).json(result);
            })
            .catch((error) => {
                console.error('데이터 조회 중 에러:', error);
                res.status(400).json({ message: '데이터 조회 중 에러가 발생했습니다.' });
            });
    } catch (error) {
        console.error('API에서 집계 쿼리 중 에러:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
