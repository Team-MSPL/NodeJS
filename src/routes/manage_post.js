const express = require('express');
const router = express.Router();
const ManagePost = require('../schemas/manage_post.js');
const Post = require('../schemas/post.js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

var _ = require('lodash');

// 게시글 신고하기
router.post('/reportPost', async (req, res) => {
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
            const { postId, reportReason, reportedAt, reportWriter } = req.body;

            const reportPost = await Post.findOne({ _id: postId });

            if (!reportPost) {
                res.status(403).json({ message: '게시글을 찾을 수 없습니다.' });
            }

            const newReport = new ManagePost({
                postId: postId,
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

            res.status(201).json({ message: '게시글 신고 완료.' });

            //내가 찾아서 하는게 아니라, 클라이언트에서 보내주는 것이 맞다
            // TravelCourse.findOne({ _id: travelId })
        } catch (error) {
            console.error('/managePost/reportPost - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
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
            console.error('/managePost/reportPost - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
});

// 커뮤니티 신고 전체 조회
router.get('/all', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        // JWT 토큰 검증 성공 시 요청 처리
        // 모든 커뮤니티 신고를 조회
        const allManagePosts = await ManagePost.find({});

        res.status(200).json(allManagePosts);
    } catch (error) {
        console.error('/managePost/all - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
