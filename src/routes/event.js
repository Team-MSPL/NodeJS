const express = require('express');
const router = express.Router();
const Event = require('../schemas/event.js');
const jwt = require('jsonwebtoken');
var _ = require('lodash');
require('dotenv').config();

// 이벤트 등록하기 ( 관리자 페이지 )
router.post('/saveEvent', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const { eventImage, eventEndDate } = req.body;

        const eventLink = req.body.eventLink || '';

        const newEvent = new Event({
            eventImage: eventImage,
            eventEndDate: eventEndDate,
            eventLink: eventLink,
        });

        const savedEvent = await newEvent.save();

        res.status(201).json({ eventId: savedEvent._id });
    } catch (error) {
        console.error('/event/saveEvent - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 이벤트 조회하기
router.get('/eventList', async (req, res) => {
    try {
        const now = new Date(); // 현재 날짜 및 시간
        const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
        const koreaTimeDiff = 9 * 60 * 60 * 1000;
        const korNow = new Date(utc + koreaTimeDiff);

        // 현재 시간이 eventEndDate보다 이전인 Event만 조회
        const eventList = await Event.find({ eventEndDate: { $gte: korNow } });

        // 조회된 이벤트들을 사용
        console.log('조회된 이벤트:', eventList);
        return res.status(200).json({ eventList: eventList });
    } catch (error) {
        console.error('/event/eventList - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 이벤트 로그 기록 - 클릭하면 True, 닫기나 오늘 안보기는 False
router.patch('/loggingEvent', async (req, res) => {
    try {
        const { eventId, eventLog } = req.body;

        let event = await Event.findOne({ _id: eventId }).catch((error) => {
            console.error('Event.findOne() 함수에 문제 발생 : ', error);
            res.status(403).json({ message: '잘못된 eventId 입니다.' });
        });

        event.eventClickLog.push(eventLog);

        await event.save();

        res.status(200).json({ message: '이벤트 로그 기록 완료' });
    } catch (error) {
        console.error('/event/loggingEvent - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
