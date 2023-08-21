const express = require('express');
const router = express.Router();
const User = require('../schemas/user.js');
const ManageUser = require('../schemas/manage_user.js');
const TravelCourse = require('../schemas/travel_course.js');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const serviceAccount = require('../../danim-3439e-firebase-adminsdk-9ud51-36d28c31ba.json'); // 서비스 계정 키의 경로

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// 1. 회원가입 ( 구글, 카카오, 애플, 익명 )
// if (디비에있으면 ) 클라에 정보주기 esle if (없으면 ) 회원가입진행 else if(회원가입플래그면) 저장하고 로그인
router.post('/signUpAndIn', async (req, res) => {
    try {
        const { userName, userProfileImage, userToken, loginProvider, signUpFlag } = req.body;

        // userToken(고유값)을 사용하여 이미 가입된 사용자가 있는지 확인
        const existingUser = await User.findOne({ userToken });
        if (existingUser) {
            //JWT토큰 생성

            // 페이로드 데이터 (토큰에 담을 정보)
            const payload = {
                userName: existingUser.userName,
                userProfileImage: existingUser.userProfileImage,
                userToken: existingUser.userToken,
                _id: existingUser._id.toString(), // 이 부분은 데이터베이스에서 생성된 고유 ID를 사용해야 합니다.
            };

            // JWT 생성
            const userJwtToken = jwt.sign(payload, '${process.env.SECRET_KEY}', { expiresIn: '180d' }); // 유효기간 180일. 6m하니까 6분되더라

            res.status(201).json({
                userId: existingUser._id.toString(),
                userName: existingUser.userName,
                userProfileImage: existingUser.userProfileImage,
                userJwtToken: userJwtToken,
                functionToken: existingUser.functionToken,
                loginProvider: existingUser.loginProvider,
            });
            //return res.status(401).json({ message: '이미 회원가입을 한 유저입니다.' });
        }
        //회원가입인데, 아직 약관 동의를 안구한 경우
        else if (!signUpFlag) {
            res.status(202).json({ message: '약관 동의가 필요합니다.' });
        }
        //회원가입인데, 약관 동의를 한 이후
        else {
            //여기가 객체에 값을 배당하는 부분임!! 여기를 수정 안해서 에러났었음
            const newUser = new User({
                userName,
                userProfileImage,
                userToken,
                loginProvider,
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
            //dotenv.config(); // .env 파일의 환경 변수 로드

            // JWT 생성
            const userJwtToken = jwt.sign(payload, '${process.env.SECRET_KEY}', { expiresIn: '180d' }); // 유효기간 180일. 6m하니까 6분되더라
            // TODO 이후에 토큰 유효기간을 1 ~ 2시간으로 줄이고, Refresh token으로 대체하자.

            // manage_user 객체도 생성 ( 회원가입 시에만 )
            const newManageUser = new ManageUser({
                userId: savedUser._id.toString(),
            });
            await newManageUser.save();

            console.log('Generated JWT:', userJwtToken);

            res.status(201).json({
                userId: savedUser._id.toString(),
                userName: savedUser.userName,
                userProfileImage: savedUser.userProfileImage,
                userJwtToken: userJwtToken,
                functionToken: savedUser.functionToken,
                loginProvider: savedUser.loginProvider,
            });
        }
    } catch (error) {
        console.log(req.body);
        console.error('/users - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. 사용자 프로필 수정하기 ( 닉네임, 사진 )
router.patch('/updateProfile', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { userName, userProfileImage } = req.body;

            //분해 하고, 나온 id로
            // Update the travel functionToken
            User.findOneAndUpdate(
                { _id: decoded._id },
                { userName: userName, userProfileImage: userProfileImage },
                { new: true }
            ) // { new: true }로 리턴값 받기
                .then((updatedProfile) => {
                    if (!updatedProfile) {
                        console.log(updatedProfile);
                        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                    }

                    //res.status(201).json(travelCourse);
                    res.status(201).json({ message: '프로필 수정 완료.' });
                })
                .catch((error) => {
                    console.error('User.findOneAndUpdate() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 입력입니다.' });
                });
        });
    } catch (error) {
        console.error('/users/updateProfile - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. 회원 탈퇴 + 구글 및 익명 -> 파이어베이스에서 사용자 정보 삭제
router.delete('/withdraw', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            console.log(req.body);

            const { userId, signUpFirebase } = req.body;

            // 사용자 찾기

            let user;

            try {
                user = await User.findOne({ _id: userId });
                if (!user) {
                    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                }
            } catch (err) {
                return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
            }

            // 사용자의 travelCourse 데이터 삭제
            await TravelCourse.deleteMany({ userId: userId });

            if (signUpFirebase) {
                try {
                    // 파이어베이스에서 사용자 인증 정보 삭제 - 이건 firebase-admin써야함
                    const auth = admin.auth();

                    // 사용자 삭제
                    auth.deleteUser(user.userToken)
                        .then(() => {
                            console.log(`Successfully deleted user with UID: ${user.userToken}`);
                        })
                        .catch((error) => {
                            console.error('Error deleting user:', error);
                            res.status(405).json({
                                message: '회원 탈퇴는 완료되었으나, Firebase에서 사용자를 찾을 수 없습니다.',
                            });
                            return;
                        });
                } catch (error) {
                    console.error('Error deleting user:', error);
                    res.status(405).json({
                        message: '회원 탈퇴는 완료되었으나, Firebase에서 사용자를 찾을 수 없습니다.',
                    });
                }
            }

            // 사용자 삭제
            await User.deleteOne({ _id: userId });

            res.status(201).json({ message: '회원 탈퇴가 완료되었습니다.' });
        });
    } catch (error) {
        console.error('/users/withdraw - DELETE 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 4. 회원 보유 기능 토큰 수정하기
router.patch('/updateFunctionToken', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { functionToken } = req.body;

            //분해 하고, 나온 id로
            // Update the travel functionToken
            User.findOneAndUpdate({ _id: decoded }, { functionToken: functionToken }, { new: true }) // { new: true }로 리턴값 받기
                .then((updatedfunctionToken) => {
                    if (!updatedfunctionToken) {
                        console.log(updatedfunctionToken);
                        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                    }

                    //res.status(201).json(travelCourse);
                    res.status(201).json({ message: '회원이 보유한 기능 토큰 갯수 수정 완료.' });
                })
                .catch((error) => {
                    console.error('User.findOneAndUpdate() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 functionToken 입니다.' });
                });

            //res.status(201).json({ message: '회원이 보유한 기능 토큰 갯수 수정 완료.' });
        });
    } catch (error) {
        console.error('/users/updateFunctionToken - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 5. 회원 전체 조회
router.get('/all', (req, res, next) => {
    User.find()
        .then((users) => {
            res.json(users);
        })
        .catch((err) => {
            console.error('/users - GET 함수에 문제 발생 : ', err);
            next(err);
        });
});

module.exports = router;
