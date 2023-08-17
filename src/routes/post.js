const express = require('express');
const router = express.Router();
const Post = require('../schemas/post.js');
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// 1. 게시글 목록 가져오기
router.get('/postList', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        let responseList = [];
        const postList = await Post.find();

        if (!postList) {
            return res.status(404).json({ message: '저장된 게시글이 없습니다.' });
        }

        postList.map((item, idx) => {
            responseList.push({
                postId: item._id.toString(),
                postTitle: item.postTitle,
                postWriter: item.postWriter,
                postedAt: item.postedAt,
                likerLength: item.liker.length,
                commentLength: item.comment.length,
            });
        });

        res.status(201).json(responseList);
    } catch (error) {
        console.error('/Post/postList - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. 게시글 하나 가져오기
router.get('/getOnePost', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const { postId } = req.query;

        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        Post.findOne({ _id: postId }) //postId를 저장해둔 것이 아니라, _id를 찾는거임
            .then((post) => {
                if (!post) {
                    console.log(post);
                    return res.status(404).json({ message: '저장된 게시글이 없습니다.' });
                }

                res.status(201).json(post);
            })
            .catch((error) => {
                console.error('Post.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 postId 입니다.' });
            });
    } catch (error) {
        console.error('/Post/getOnePost - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. 게시글 저장하기
router.post('/savePost', async (req, res) => {
    try {
        // 클라이언트에서 전달한 JWT 토큰 추출
        const token = req.header('Authorization').split(' ')[1];

        // JWT 토큰 검증
        dotenv.config(); // .env 파일의 환경 변수 로드

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // JWT 토큰 검증 성공 시 요청 처리
            //분해 하고, 나온 id로
            let postWriter = await User.findOne({ _id: decoded._id });

            if (!postWriter) {
                res.status(403).json({ message: '사용자를 찾을 수 없습니다.' });
            }

            const { postTitle, postContent, postImage, postedAt } = req.body;

            const newPost = new Post({
                postTitle: postTitle,
                postContent: postContent,
                postImage: postImage,
                postWriter: postWriter.userName,
                postWriterUserId: postWriter._id.toString(),
                postWriterProfileImage: postWriter.userProfileImage,
                postedAt: postedAt,
            });

            const savedPost = await newPost.save();

            res.status(201).json({ postId: savedPost._id });
        });
    } catch (error) {
        console.error('/Post/savePost - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 4. 게시글 수정하기
router.patch('/updatePost', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { postId, postTitle, postContent, postImage } = req.body; // 수정할 필드들을 담은 객체

            // Update the Post
            Post.findOneAndUpdate(
                { _id: postId },
                { postTitle: postTitle, postContent: postContent, postImage: postImage },
                { new: true }
            )
                .then((updatedPost) => {
                    if (!updatedPost) {
                        console.log(updatedPost);
                        return res.status(404).json({ message: '수정할 게시글을 찾을 수 없습니다.' });
                    }

                    //res.status(201).json(travelCourse);
                    res.status(201).json({ message: '게시글 수정 완료.' });
                })
                .catch((error) => {
                    console.error('Post.findOneAndUpdate() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 postId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/Post/updatePost - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 5. 게시글 삭제하기
router.delete('/deletePost', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { postId } = req.body;

            // Delete the travel course
            Post.findOneAndDelete({ _id: postId })
                .then((deletedPost) => {
                    if (!deletedPost) {
                        return res.status(404).json({ message: '삭제할 게시글을 찾을 수 없습니다.' });
                    }

                    res.status(200).json({ message: '게시글 삭제 완료.' });
                })
                .catch((error) => {
                    console.error('Post.findOneAndDelete() 함수에 문제 발생 : ', error);
                    res.status(500).json({ message: '서버 내부 오류 발생' });
                });
        });
    } catch (error) {
        console.error('/Post/deletePost - DELETE 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 6. 좋아요 추가하기
router.patch('/clickLike', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { postId } = req.body; // 수정할 필드들을 담은 객체

            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            Post.findOne({ _id: postId }) //postId를 저장해둔 것이 아니라, _id를 찾는거임
                .then(async (post) => {
                    if (!post) {
                        console.log(post);
                        return res.status(404).json({ message: '저장된 게시글이 없습니다.' });
                    }

                    //배열을 받아와서 그대로 저장하면, 여러곳에서 동시에 커뮤니티를 할 경우, 업데이트 문제가 생길 수 있음
                    post.liker.push(decoded._id.toString());

                    await post.save();

                    res.status(201).json({ message: '좋아요가 추가되었습니다.' });
                })
                .catch((error) => {
                    console.error('Post.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 postId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/Post/clickLike - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 7. 좋아요 취소하기
router.patch('/unclickLike', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { postId } = req.body; // 수정할 필드들을 담은 객체

            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            Post.findOne({ _id: postId }) //postId를 저장해둔 것이 아니라, _id를 찾는거임
                .then(async (post) => {
                    if (!post) {
                        console.log(post);
                        return res.status(404).json({ message: '저장된 게시글이 없습니다.' });
                    }

                    //배열을 받아와서 그대로 저장하면, 여러곳에서 동시에 커뮤니티를 할 경우, 업데이트 문제가 생길 수 있음
                    post.liker = post.liker.filter((item) => item != decoded._id.toString());

                    await post.save();

                    res.status(201).json({ message: '좋아요가 취소되었습니다.' });
                })
                .catch((error) => {
                    console.error('Post.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 postId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/Post/unclickLike - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 8. 댓글 추가하기
router.patch('/saveComment', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }
            let commentWriter = await User.findOne({ _id: decoded._id });
            if (!commentWriter) {
                res.status(403).json({ message: '사용자를 찾을 수 없습니다.' });
            }

            const { postId, comment } = req.body; // 수정할 필드들을 담은 객체

            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            Post.findOne({ _id: postId }) //postId를 저장해둔 것이 아니라, _id를 찾는거임
                .then(async (post) => {
                    if (!post) {
                        console.log(post);
                        return res.status(404).json({ message: '저장된 게시글이 없습니다.' });
                    }

                    //배열을 받아와서 그대로 저장하면, 여러곳에서 동시에 커뮤니티를 할 경우, 업데이트 문제가 생길 수 있음. 그래서 push
                    post.comment.push(comment);

                    await post.save();

                    res.status(201).json({ commentId: post.comment.at(-1)._id.toString() });
                })
                .catch((error) => {
                    console.error('Post.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 postId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/post/saveComment - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 9. 댓글 삭제하기
router.patch('/deleteComment', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { postId, commentId } = req.body; // 수정할 필드들을 담은 객체

            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            Post.findOne({ _id: postId }) //postId를 저장해둔 것이 아니라, _id를 찾는거임
                .then(async (post) => {
                    if (!post) {
                        console.log(post);
                        return res.status(404).json({ message: '저장된 게시글이 없습니다.' });
                    }

                    let beforeLength = post.comment.length;

                    //배열을 받아와서 그대로 저장하면, 여러곳에서 동시에 커뮤니티를 할 경우, 업데이트 문제가 생길 수 있음
                    post.comment = post.comment.filter((item) => item._id.toString() !== commentId);

                    if (beforeLength === post.comment.length) {
                        return res.status(405).json({ message: '삭제할 댓글이 없습니다.' });
                    }

                    await post.save();

                    res.status(201).json({ message: '댓글이 삭제되었습니다.' });
                })
                .catch((error) => {
                    console.error('Post.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 postId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/post/deleteComment - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
