const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const User = require('../schemas/user.js');
const Transit = require('../schemas/transit.js');
const admin = require('firebase-admin');
const cron = require('node-cron');
require('dotenv').config();

// 1. 항공사, 철도 이름 -> 항공사, 철도 아이콘 매칭
router.get('/icon/:line', async (req, res) => {
    res.status(200).json({});
});

// 2. 이동편 불러오기
router.get('/:travelId', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const { travelId } = req.params;

        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        Transit.find({ travelId: travelId })
            .then((transit) => {
                if (!transit) {
                    console.log(transit);
                    return res.status(404).json({ message: '저장된 이동편이 없습니다.' });
                }

                res.status(200).json(transit);
            })
            .catch((error) => {
                console.error('Transit.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 travelId 입니다.' });
            });
    } catch (error) {
        console.error('/transit - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. 이동편 저장하기
router.post('/', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const { travelId, transitDay, direction, port, line, regNum, lat, lng } = req.body;

        const newTransit = new Transit({
            travelId,
            transitDay,
            direction,
            lat,
            lng,
            port,
            line,
            regNum,
        });

        const savedTransit = await newTransit.save();

        res.status(200).json({
            transitId: savedTransit._id.toString(),
        });
    } catch (error) {
        console.error('/transit - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 4. 이동편 수정하기
router.patch('/', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const { travelId, ...updateData } = req.body;

        Transit.findOneAndUpdate({ travelId: travelId }, updateData, { new: true }) // { new: true }로 리턴값 받기
            .then((updatedTransit) => {
                if (!updatedTransit) {
                    console.log(updatedTransit);
                    return res.status(404).json({ message: '수정할 이동편을 찾을 수 없습니다.' });
                }

                res.status(200).json({ message: '이동편 수정 완료.' });
            })
            .catch((error) => {
                console.error('Transit.findOneAndUpdate() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 travelId 입니다.' });
            });
    } catch (error) {
        console.error('/transit - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 5. 이동편 삭제하기
router.delete('/', async (req, res) => {
    try {
        const { travelId } = req.body;

        const deletedTransit = await Transit.findOne({ travelId: travelId });

        if (!deletedTransit) {
            return res.status(404).json({ message: '삭제할 이동편을 찾을 수 없습니다.' });
        } else {
            deletedTransit.deleteOne({ travelId: travelId });
            res.status(200).json({ message: '이동편 삭제 완료.' });
        }
    } catch (error) {
        console.error('/transit - DELETE 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
