const express = require('express');
const router = express.Router();
const ManageUser = require('../schemas/manage_user.js');
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
require('dotenv').config();
var _ = require('lodash');

// 오늘자 광고 시청 횟수 확인하기
router.get('/watchADTime', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            const manageUser = await ManageUser.findOne({ userId: decoded._id.toString() });

            const now = new Date(); // 현재 날짜 및 시간
            const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
            const koreaTimeDiff = 9 * 60 * 60 * 1000;
            const korNow = new Date(utc + koreaTimeDiff);

            if (!manageUser) {
                res.status(403).json({ message: '사용자를 찾을 수 없습니다.' });
            }
            if (!manageUser.watchADTime || !manageUser.recentADDate) {
                manageUser.watchADTime = 0;
                manageUser.recentADDate = korNow;
                await manageUser.save();
            }
            //하루가 지나면 초기화
            else if (
                manageUser.recentADDate.getDate() !== korNow.getDate() ||
                manageUser.recentADDate.getMonth() !== korNow.getMonth() ||
                manageUser.recentADDate.getFullYear() !== korNow.getFullYear()
            ) {
                manageUser.watchADTime = 0;
                manageUser.recentADDate = korNow;
                await manageUser.save();
            }

            return res.status(201).json({ watchADTime: manageUser.watchADTime });
        } catch (error) {
            console.error('/manage/watchADTime - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
});
// 오늘자 광고 시청 횟수 세팅하기
router.patch('/setWatchADTime', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            const manageUser = await ManageUser.findOne({ userId: decoded._id.toString() });

            const { watchADTime } = req.body;

            if (!manageUser) {
                res.status(403).json({ message: '사용자를 찾을 수 없습니다.' });
            }

            const now = new Date(); // 현재 날짜 및 시간
            const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
            const koreaTimeDiff = 9 * 60 * 60 * 1000;
            const korNow = new Date(utc + koreaTimeDiff);

            manageUser.watchADTime = watchADTime;
            manageUser.recentADDate = korNow;
            await manageUser.save();

            return res.status(201).json({ watchADTime: manageUser.watchADTime });
        } catch (error) {
            console.error('/manage/watchADTime - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
});

// 총 기능 사용 횟수 확인하기
router.get('/sumUseTokenTime', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        // manageUser 모델에서 모든 데이터를 가져옴
        const manageUserList = await ManageUser.find();

        // UseTokenTime 필드의 값을 합산
        const totalSum = manageUserList.reduce((accumulator, currentValue) => {
            return accumulator + currentValue.useTokenTime;
        }, 0);

        // 합산된 값을 클라이언트에 반환
        res.status(201).json({ result: totalSum });
    } catch (error) {
        console.error('/manageUser/sumUseTokenTime - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'leternal server error' });
    }
});

// 댓글 신고하기
router.post('/reportComment', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    //dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            const { postId, commentId, reportReason, reportedAt, reportWriter } = req.body;

            const reportPost = await Post.findOne({ _id: postId });

            if (!reportPost) {
                res.status(403).json({ message: '게시글을 찾을 수 없습니다.' });
            }

            let commentFlag = false;

            for (let i = 0; i < reportPost.comment.length; i++) {
                if (reportPost.comment[i]._id.toString() === commentId) {
                    commentFlag = true;
                    break;
                }
            }

            if (commentFlag) {
                const newReport = new ManagePost({
                    commentId: commentId,
                    reportReason: reportReason,
                    reportedAt: reportedAt,
                    reportWriter: reportWriter,
                    post: reportPost,
                    // post: {
                    //     postTitle: post.postTitle,
                    //     postContent: post.postContent,
                    //     postPhoto: post.postPhoto,
                    //     postWriter: post.postWriter,
                    //     createdAt: post.createdAt,
                    //     likeClicker: post.likeClicker,
                    //     comment: post.comment,
                    // },
                });

                //DB에 저장
                await newReport.save();

                return res.status(201).json({ message: '댓글 신고 완료.' });
            } else {
                res.status(403).json({ message: '댓글을 찾을 수 없습니다.' });
            }
            //내가 찾아서 하는게 아니라, 클라이언트에서 보내주는 것이 맞다
            // TravelCourse.findOne({ _id: travelId })
        } catch (error) {
            console.error('/manage/reportComment - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
});

// 토큰 사용 로그 찾기
router.get('/tokenLog', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    //dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            const manageUser = await ManageUser.findOne({ userId: decoded._id.toString() });

            if (!manageUser) {
                res.status(403).json({ message: '사용자를 찾을 수 없습니다.' });
            }
            if (!manageUser.tokenLog || manageUser.tokenLog.length === 0) {
                manageUser.tokenLog = [];
                await manageUser.save();
            }

            return res
                .status(201)
                .json({ tokenLog: manageUser.tokenLog.sort((a, b) => b.tokenLogDate - a.tokenLogDate) });
        } catch (error) {
            console.error('/manage/tokenLog - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
});

// 6. 회원에게 쪽지 보내기
router.patch('/sendNote', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const { userId, note } = req.body;

        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        User.findOne({ _id: userId })
            .then(async (user) => {
                if (!user) {
                    console.log(user);
                    return res.status(404).json({ message: '저장된 유저가 없습니다.' });
                }
                user.noteList.push(note);

                await user.save();

                // 여기서 FCM 푸시 알림 보내기
                if (user.fcmToken) {
                    const payload = {
                        notification: {
                            title: '새로운 쪽지 도착!',
                            body: note,
                            image: 'https://danim.me/square_logo.png', // 이미지 URL을 여기에 추가
                        },
                        data: {
                            // 여기에 필요한 데이터를 추가할 수 있습니다.
                            // 예: noteId, senderId 등
                        },
                    };

                    await admin.messaging().sendToDevice(user.fcmToken, payload);
                }

                res.status(201).json({ message: '쪽지 전송 완료.' });
            })
            .catch((error) => {
                console.error('User.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 userId 입니다.' });
            });
    } catch (error) {
        console.error('/users/sendNote - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
