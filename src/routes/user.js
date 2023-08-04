const express = require('express');
const router = express.Router();
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// 사용자 전체 조회
router.get('/all', (req, res, next) => {
    User.find()
        .then((users) => {
            res.json(users);
        })
        .catch((err) => {
            console.error('/users - GET 함수에 문제 발생 : ', error);
            next(err);
        });
});

// 사용자 단일 조회 (userName, userToken을 기준으로)
router.get('/signIn/:userName/:userToken', async (req, res) => {
    const { userName, userToken } = req.params;

    try {
        const user = await User.findOne({ userName, userToken });

        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        res.json(user);
    } catch (error) {
        console.error('/users/:userName/:userToken - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 사용자 회원 가입
router.post('/signUp', async (req, res) => {
    try {
        const { userName, userProfileImage, userToken } = req.body;

        // userToken(고유값)을 사용하여 이미 가입된 사용자가 있는지 확인
        const existingUser = await User.findOne({ userToken });
        if (existingUser) {
            return res.status(400).json({ message: '이미 회원가입을 한 유저입니다.' });
        }

        //여기가 객체에 값을 배당하는 부분임!! 여기를 수정 안해서 에러났었음
        const newUser = new User({
            userName,
            userProfileImage,
            userToken,
        });

        const savedUser = await newUser.save();

        //JWT토큰 생성

        // 페이로드 데이터 (토큰에 담을 정보)
        const payload = {
            userName: savedUser.userName,
            userProfileImage: savedUser.userProfileImage,
            userToken: savedUser.userToken,
            _id: savedUser._id.toString(), // 이 부분은 데이터베이스에서 생성된 고유 ID를 사용해야 합니다.
        };

        // JWT 비밀키 (이 비밀키를 가지고 토큰을 생성하고 검증합니다)
        dotenv.config(); // .env 파일의 환경 변수 로드

        // JWT 생성
        const userJwtToken = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '6m' }); // 유효기간 6개월
        // TODO 이후에 토큰 유효기간을 1~2시간으로 줄이고, Refresh token으로 대체하자.

        // JWT 저장
        // TODO 저장 안하는 방식도 고려할 것. 실제로 재윤이도 저장 안함
        savedUser.userJwtToken = userJwtToken;
        await savedUser.save(); // 토큰을 저장한 후 데이터베이스 업데이트

        console.log('Generated JWT:', userJwtToken);

        res.status(201).json({
            userId: savedUser._id.toString(),
            userName: userName,
            userProfileImage: userProfileImage,
            userToken: userToken,
            userJwtToken: userJwtToken,
        });
    } catch (error) {
        console.log(req.body);
        console.error('/users - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
