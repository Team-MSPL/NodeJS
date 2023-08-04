const express = require('express');
const router = express.Router();
const User = require('../schemas/users.js');

// 사용자 전체 조회
router.get('/', (req, res, next) => {
    User.find()
        .then((users) => {
            res.json(users);
        })
        .catch((err) => {
            console.error(err);
            next(err);
        });
});

// 유저 생성
// router.post('/', (req, res, next) => {
//     const user = new User({
//         userName: req.body.userName,
//         userProfileImage: req.body.userProfileImage,
//         userToken: req.body.userToken,
//     });
//     user.save()
//         .then((result) => {
//             res.json(result);
//         })
//         .catch((err) => {
//             console.error(err);
//             next(err);
//         });
// });
router.post('/', async (req, res) => {
    try {
        const { userName, userProfileImage, userToken } = req.body;

        //여기가 객체에 값을 배당하는 부분임!! 여기를 수정 안해서 에러났었음
        const newUser = new User({
            userName,
            userProfileImage,
            userToken,
        });

        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
    } catch (error) {
        console.log(req.body);
        console.error('/users - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
