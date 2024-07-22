const express = require('express');
const router = express.Router();
const User = require('../schemas/user.js');
const ManageUser = require('../schemas/manage_user.js');
const TravelCourse = require('../schemas/travel_course.js');
const Post = require('../schemas/post.js');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
var _ = require('lodash');
require('dotenv').config();
const serviceAccount = require('../../danim-3439e-firebase-adminsdk-9ud51-36d28c31ba.json'); // 서비스 계정 키의 경로

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// 1. 회원가입 ( 구글, 카카오, 애플, 익명 )
// if (디비에있으면 ) 클라에 정보주기 esle if (없으면 ) 회원가입진행 else if(회원가입플래그면) 저장하고 로그인
router.post('/signUpAndIn', async (req, res) => {
    //로그인시, 출석 보상
    let daliyReward = false;
    try {
        const { userName, userProfileImage, userToken, loginProvider, signUpFlag } = req.body;

        const fcmToken = req.body.hasOwnProperty('fcmToken') ? req.body.fcmToken : '';

        const version = req.body.hasOwnProperty('version') ? req.body.version : 1;

        // userToken(고유값)을 사용하여 이미 가입된 사용자가 있는지 확인
        const existingUser = await User.findOne({ userToken });

        if (existingUser) {
            //JWT토큰 생성

            // 페이로드 데이터 (토큰에 담을 정보)
            const payload = {
                userToken: existingUser.userToken,
                _id: existingUser._id.toString(), // 이 부분은 데이터베이스에서 생성된 고유 ID를 사용해야 합니다.
            };

            // JWT 생성
            const userJwtToken = jwt.sign(payload, '${process.env.SECRET_KEY}', { expiresIn: '180d' }); // 유효기간 180일. 6m하니까 6분되더라

            const now = new Date(); // 현재 날짜 및 시간
            const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
            const koreaTimeDiff = 9 * 60 * 60 * 1000;
            const korNow = new Date(utc + koreaTimeDiff);
            if (!existingUser.blockUserList) {
                existingUser.blockUserList = [];
                await existingUser.save();
            }
            if (!existingUser.fcmToken) {
                existingUser.fcmToken = fcmToken;
                await existingUser.save();
            } else {
                existingUser.fcmToken = fcmToken;
                await existingUser.save();
            }
            if (
                existingUser.recentLogin.getDate() !== korNow.getDate() ||
                existingUser.recentLogin.getMonth() !== korNow.getMonth() ||
                existingUser.recentLogin.getFullYear() !== korNow.getFullYear()
            ) {
                // existingUser.functionToken += 1;
                // dailyReward = true;
                // 최근 접속 시간 및 날짜 업데이트
                existingUser.recentLogin = korNow;
                if (!existingUser.loginLogList) {
                    existingUser.loginLogList = [];
                }
                existingUser.loginLogList.push(korNow);

                await existingUser.save();
            }

            res.status(201).json({
                userId: existingUser._id.toString(),
                userName: existingUser.userName,
                userProfileImage: existingUser.userProfileImage,
                userJwtToken: userJwtToken,
                functionToken: existingUser.functionToken,
                loginProvider: existingUser.loginProvider,
                dailyReward: daliyReward,
                blockUserList: existingUser.blockUserList,
                fcmToken: existingUser.fcmToken,
            });
            //return res.status(401).json({ message: '이미 회원가입을 한 유저입니다.' });
        }
        //회원가입인데, 아직 약관 동의를 안구한 경우
        else if (!signUpFlag) {
            if (version === 1) {
                res.status(202).json({ message: '약관 동의가 필요합니다.' });
            } else {
                // userToken(고유값)을 사용하여 과거에 한 번 가입했었던 사용자인지 확인
                const existedUser = await ManageUser.findOne({ userToken: userToken });

                if (!existedUser) {
                    res.status(202).json({ message: '약관 동의가 필요합니다.' });
                } else {
                    //여기가 객체에 값을 배당하는 부분임!! 여기를 수정 안해서 에러났었음
                    const now = new Date(); // 현재 날짜 및 시간
                    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
                    const koreaTimeDiff = 9 * 60 * 60 * 1000;
                    const korNow = new Date(utc + koreaTimeDiff);
                    const comeBackUser = new User({
                        userName: userName,
                        userProfileImage: userProfileImage,
                        loginProvider: loginProvider,
                        createdAt: korNow,
                        loginLogList: [korNow],
                        recentLogin: korNow,
                        fcmToken: fcmToken,
                        //기존 정보 가져오기
                        userToken: existedUser.userToken,
                        functionToken: existedUser.functionToken,
                        noteList: existedUser.noteList,
                        blockUserList: existedUser.blockUserList,
                    });

                    const savedComeBackUser = await comeBackUser.save();

                    //JWT토큰 생성

                    // 페이로드 데이터 (토큰에 담을 정보)
                    const payload = {
                        userToken: savedComeBackUser.userToken,
                        _id: savedComeBackUser._id.toString(), // 이 부분은 데이터베이스에서 생성된 고유 ID를 사용해야 합니다.
                    };

                    // JWT 비밀키 (이 비밀키를 가지고 토큰을 생성하고 검증합니다)
                    //dotenv.config(); // .env 파일의 환경 변수 로드

                    // JWT 생성
                    const userJwtToken = jwt.sign(payload, '${process.env.SECRET_KEY}', { expiresIn: '180d' }); // 유효기간 180일. 6m하니까 6분되더라
                    // TODO 이후에 토큰 유효기간을 1 ~ 2시간으로 줄이고, Refresh token으로 대체하자.

                    console.log('Generated JWT:', userJwtToken);

                    //manageUser도 userId 업데이트!!!
                    existedUser.userId = savedComeBackUser._id.toString();
                    await existedUser.save();

                    //status : 203 이면, 복귀 유저
                    res.status(203).json({
                        userId: savedComeBackUser._id.toString(),
                        userName: savedComeBackUser.userName,
                        userProfileImage: savedComeBackUser.userProfileImage,
                        userJwtToken: userJwtToken,
                        functionToken: savedComeBackUser.functionToken,
                        loginProvider: savedComeBackUser.loginProvider,
                        dailyReward: daliyReward,
                        blockUserList: savedComeBackUser.blockUserList,
                        fcmToken: savedComeBackUser.fcmToken,
                    });
                }
            }
        }
        //회원가입인데, 약관 동의를 한 이후
        else {
            //여기가 객체에 값을 배당하는 부분임!! 여기를 수정 안해서 에러났었음
            const now = new Date(); // 현재 날짜 및 시간
            const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
            const koreaTimeDiff = 9 * 60 * 60 * 1000;
            const korNow = new Date(utc + koreaTimeDiff);
            const newUser = new User({
                userName: userName,
                userProfileImage: userProfileImage,
                userToken: userToken,
                loginProvider: loginProvider,
                createdAt: korNow,
                loginLogList: [korNow],
                recentLogin: korNow,
                fcmToken: fcmToken,
            });

            const savedUser = await newUser.save();

            //JWT토큰 생성

            // 페이로드 데이터 (토큰에 담을 정보)
            const payload = {
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
                //
                tokenLog: [{ tokenLogContent: '회원가입 축하 보상', tokenLogNumber: 5, tokenLogDate: now.getTime() }],
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
                dailyReward: daliyReward,
                blockUserList: savedUser.blockUserList,
                fcmToken: savedUser.fcmToken,
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
                .then(async (updatedProfile) => {
                    if (!updatedProfile) {
                        console.log(updatedProfile);
                        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                    }

                    // 프로필 이름이 변경되면 연관된 Post의 postWriter, postWriterProfileImage 필드도 변경
                    Post.updateMany(
                        { postWriterUserId: decoded._id, postedAt: { $gt: '2024/05/08 00:00:00' } }, // 2024년 5월 8일 이후에 작성된 Post
                        { $set: { postWriter: updatedProfile.userName } }, // postWriter 필드를 새로운 프로필 이름으로 변경
                        { $set: { postWriterProfileImage: updatedProfile.userProfileImage } } // postWriterProfileImage 필드를 새로운 프로필 이름으로 변경
                    ).then(() => {
                        //res.status(201).json(travelCourse);
                        res.status(201).json({ message: '프로필 수정 완료.' });
                    });
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

            const withdrawReasonList = req.body.hasOwnProperty('withdrawReasonList') ? req.body.withdrawReasonList : [];

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

            //ManageUser에 유저 정보 남겨두기
            await ManageUser.findOne({ userId: userId })
                .then(async (manageUser) => {
                    if (!manageUser) {
                        // 없으면 새로 만들어야함 - 회원가입때 manageUser 만드는 로직을 만들기 전에 가입하여, 기능을 한 번도 안썼으면 이 객체가 없음

                        const newManageUser = new ManageUser({
                            userId: user._id.toString(),
                            userToken: user.userToken,
                            functionToken: user.functionToken,
                            noteList: user.noteList,
                            blockUserList: user.blockUserList,
                            withdrawReasonList: withdrawReasonList,
                        });

                        await newManageUser.save();
                    } else {
                        manageUser.userId = user._id.toString();
                        manageUser.userToken = user.userToken;
                        manageUser.functionToken = user.functionToken;
                        manageUser.noteList = user.noteList;
                        manageUser.blockUserList = user.blockUserList;
                        manageUser.withdrawReasonList = [...manageUser.withdrawReasonList, ...withdrawReasonList];

                        await manageUser.save();
                    }

                    // 사용자 삭제
                    await User.deleteOne({ _id: userId });

                    res.status(201).json({ message: '회원 탈퇴가 완료되었습니다.' });
                })
                .catch((error) => {
                    console.error('ManageUser.findOne() 함수에 문제 발생 : ', error);
                    res.status(401).json({ message: 'Unauthorized' });
                });
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

            let diffToken = 0;

            //분해 하고, 나온 id로
            // Update the travel functionToken
            let user = await User.findOne({ _id: decoded._id }).catch((error) => {
                console.error('User.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 userId 입니다.' });
            });

            //manage_user에 로그 추가
            await ManageUser.findOne({ userId: decoded._id.toString() })
                .then(async (manageUser) => {
                    if (!manageUser) {
                        console.log(manageUser);
                        res.status(401).json({ message: 'Unauthorized' });
                        return;
                    }
                    const now = new Date(); // 현재 날짜 및 시간
                    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
                    const koreaTimeDiff = 9 * 60 * 60 * 1000;
                    const korNow = new Date(utc + koreaTimeDiff);

                    if (!manageUser.tokenLog) {
                        manageUser.tokenLog = [];
                    }

                    //토큰 갯수가 늘어나야만, 이용권 충전임
                    if (functionToken - user.functionToken > 0) {
                        manageUser.tokenLog.push({
                            tokenLogContent: '이용권 충전',
                            tokenLogNumber: functionToken - user.functionToken,
                            tokenLogDate: now.getTime(),
                        });
                    }

                    await manageUser.save();
                })
                .catch((error) => {
                    console.error('ManageUser.findOne() 함수에 문제 발생 : ', error);
                    res.status(401).json({ message: 'Unauthorized' });
                    return;
                });

            //update user functionToken
            user.functionToken = functionToken;

            await user.save();

            res.status(201).json({ message: '회원이 보유한 기능 토큰 갯수 수정 완료.' });
        });
    } catch (error) {
        console.error('/users/updateFunctionToken - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 5. 회원 쪽지함 가져오기
router.get('/noteList', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            let user;

            try {
                user = await User.findOne({ _id: decoded._id });
                if (!user) {
                    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                }
            } catch (err) {
                return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
            }
            if (!user.noteList) {
                user.noteList = [];
                await user.save();
            }

            res.status(201).json(user.noteList);
        });
    } catch (error) {
        console.error('/User/noteList - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 6. 회원 로그아웃하기 ( fcmToken 제거하여, 로그아웃하면 알림 안가게 )
router.patch('/signOut', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            //분해 하고, 나온 id로
            User.findOne({ _id: decoded._id })
                .then(async (profile) => {
                    if (!profile) {
                        console.log(profile);
                        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                    }

                    //fcmToken 제거하여, 로그아웃하면 알림 안가게
                    profile.fcmToken = '';

                    await profile.save();
                    res.status(201).json({ message: '사용자 로그아웃 완료. ( fcm토큰 제거 완료. )' });
                })
                .catch((error) => {
                    console.error('User.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 입력입니다.' });
                });
        });
    } catch (error) {
        console.error('/users/signOut - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 7. 회원 차단하기
router.patch('/blockUser', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { blockUserId } = req.body;

            //분해 하고, 나온 id로
            // Update the travel functionToken
            User.findOne({ _id: decoded._id })
                .then(async (profile) => {
                    if (!profile) {
                        console.log(profile);
                        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                    }

                    //배열을 받아와서 그대로 저장하면, 여러곳에서 동시에 커뮤니티를 할 경우, 업데이트 문제가 생길 수 있음. 그래서 push
                    profile.blockUserList.push(blockUserId);

                    await profile.save();
                    res.status(201).json({ message: '사용자 차단 완료.' });
                })
                .catch((error) => {
                    console.error('User.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 입력입니다.' });
                });
        });
    } catch (error) {
        console.error('/users/blockUser - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 8. 회원 전체 조회
router.get('/all', (req, res, next) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    User.find()
        .then((users) => {
            res.json(users);
        })
        .catch((err) => {
            console.error('/users - GET 함수에 문제 발생 : ', err);
            next(err);
        });
});

// 9. 리텐션한 유저 수 확인
router.get('/retention', async (req, res, next) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    const users = await User.find({}).sort({ recentLogin: -1 }); // 최근 로그인 순으로 정렬

    // 차이가 1일 이상인 모든 유저 선택
    const usersWithLargeInterval = users
        .filter((user) => user.recentLogin && user.recentLogin - user.createdAt >= 24 * 60 * 60 * 1000) // 1일 이상 차이나는 경우
        .map((user) => ({
            userName: user.userName,
            userId: user._id,
            loginInterval: formatInterval(Math.abs(user.recentLogin - user.createdAt)),
            loginLogList: user.loginLogList,
        }))
        .sort((a, b) => b.loginInterval - a.loginInterval);

    res.json({ retentionUserNum: usersWithLargeInterval.length, retentionUserList: usersWithLargeInterval });
});

// ms를 mm월 dd일 hh시간 mm분 형식으로 변환하는 함수
function formatInterval(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const formattedInterval = `${days}일 ${hours % 24}시간 ${minutes % 60}분`;
    return formattedInterval;
}

module.exports = router;
