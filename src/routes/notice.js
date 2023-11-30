const express = require('express');
const router = express.Router();
const Notice = require('../schemas/notice.js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

var _ = require('lodash');

// 1. 공지사항 목록 가져오기 ( 20개씩 )
router.get('/noticeList', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const page = req.query.page || 1; // 페이지 번호를 쿼리 매개변수로 받아옵니다.
        const perPage = 20; // 페이지당 게시물 수

        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;

        let filter = {}; // 검색 필터 초기화

        let noticeList = [];

        //디폴트, 최신순
        noticeList = await Notice.find(filter) // filter를 find 메서드로 전달
            .sort({ noticeedAt: -1 }) // String 형태의 날짜를 Date 타입으로 변환하여 최신순으로 정렬
            .skip(startIndex)
            .limit(perPage);

        if (!noticeList || noticeList.length === 0) {
            return res.status(404).json({ message: '저장된 공지사항이 없습니다.' });
        }

        res.status(201).json(noticeList);
    } catch (error) {
        console.error('/notice/noticeList - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. 공지사항 하나 가져오기
router.get('/getOneNotice', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const { noticeId } = req.query;

        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        Notice.findOne({ _id: noticeId }) //noticeId를 저장해둔 것이 아니라, _id를 찾는거임
            .then((notice) => {
                if (!notice) {
                    console.log(notice);
                    return res.status(404).json({ message: '저장된 공지사항이 없습니다.' });
                }

                res.status(201).json(notice);
            })
            .catch((error) => {
                console.error('Notice.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 noticeId 입니다.' });
            });
    } catch (error) {
        console.error('/notice/getOneNotice - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. 공지사항 저장하기(관리자용)
router.notice('/saveNotice', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const { noticeTitle, noticeContent, noticeImage, noticedAt } = req.body;

        const newNotice = new Notice({
            noticeTitle: noticeTitle,
            noticeContent: noticeContent,
            noticeImage: noticeImage,
            noticedAt: noticedAt,
        });

        const savedNotice = await newNotice.save();

        res.status(201).json({ noticeId: savedNotice._id });
    } catch (error) {
        console.error('/notice/saveNotice - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
