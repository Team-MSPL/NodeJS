const express = require('express');
const router = express.Router();
const News = require('../schemas/news.js');
require('dotenv').config();

var _ = require('lodash');

// 1. 뉴스 목록 가져오기 ( 5개씩 )
router.get('/newsList', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const page = req.query.page || 1; // 페이지 번호를 쿼리 매개변수로 받아옵니다.
        const perPage = 5; // 페이지당 게시물 수

        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;

        let filter = {}; // 검색 필터 초기화

        let newsList = [];

        newsLength = (await News.find()).length;

        //디폴트, 최신순
        newsList = await News.find(filter) // filter를 find 메서드로 전달
            .sort({ newsDate: -1 }) // String 형태의 날짜를 Date 타입으로 변환하여 최신순으로 정렬
            .skip(startIndex)
            .limit(perPage);

        if (!newsList || newsList.length === 0) {
            return res.status(404).json({ message: '저장된 뉴스가 없습니다.' });
        }

        res.status(201).json({ newsList: newsList, newsLength: newsLength });
    } catch (error) {
        console.error('/news/newsList - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. 뉴스 저장하기(관리자용)
router.post('/saveNews', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const { newsTitle, newsContent, newsImage, newsDate, newsLink } = req.body;

        const newNews = new News({
            newsTitle: newsTitle,
            newsContent: newsContent,
            newsImage: newsImage,
            newsDate: newsDate,
            newsLink: newsLink,
        });

        const savedNews = await newNews.save();

        res.status(201).json({ newsId: savedNews._id });
    } catch (error) {
        console.error('/news/saveNews - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
