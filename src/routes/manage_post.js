const express = require('express');
const router = express.Router();
const ManagePost = require('../schemas/manage_post.js');
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
            const { postId, reportReason, reportTime, reportWriter, post } = req.body;

            // 여행 코스에 대한 별점과 리뷰 정보 저장
            const newReport = new ManagePost({
                postId: postId,
                reportReason: reportReason,
                reportTime: reportTime,
                reportWriter: reportWriter,
                post: post,
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
            console.error('/manage/reportPost - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
});

module.exports = router;
