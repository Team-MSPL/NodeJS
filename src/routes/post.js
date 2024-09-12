const express = require('express');
const router = express.Router();
const Post = require('../schemas/post.js');
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// 1. 게시글 목록 가져오기 ( 20개씩 )
router.get('/postList', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const page = req.query.page || 1; // 페이지 번호를 쿼리 매개변수로 받아옵니다.
        const perPage = 20; // 페이지당 게시물 수

        const sortMode = req.query.sort || 1; // 정렬방법을 쿼리 매개변수로 받아옵니다.

        const searchQuery = req.query.search || ''; // 검색어를 쿼리 매개변수로 받아옵니다.

        const blockedUserIDs = req.query.blockedUserIDs || []; // 차단할 여러 명의 유저의 userID를 배열로 받아옵니다.

        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;

        let filter = {}; // 검색 필터 초기화

        let postList = [];

        // 검색어가 제공된 경우, postTitle 또는 postContent에 검색어가 포함된 게시물 필터링
        if (searchQuery || searchQuery == '') {
            filter = {
                $or: [
                    { postTitle: { $regex: searchQuery, $options: 'i' } }, // 대소문자 무시
                    { postContent: { $regex: searchQuery, $options: 'i' } },
                ],
            };
        }

        // 차단할 유저들의 userID가 제공된 경우, 해당 유저들이 작성한 글은 제외하고 나머지 글만 보이게 필터링
        if (blockedUserIDs.length > 0) {
            filter.postWriterUserId = { $nin: blockedUserIDs }; // $nin은 해당 값들을 제외하라는 조건입니다.
        }

        //좋아요순
        if (sortMode == 2) {
            console.log(sortMode);
            //이 부분은 선택적으로 포함할 필드를 지정하는 부분입니다.
            //1은 해당 필드를 포함하겠다는 의미이며, 0을 사용하면 해당 필드를 제외하겠다는 의미
            postList = await Post.aggregate([
                {
                    $project: {
                        postId: { $toString: '$_id' },
                        postTitle: 1,
                        ImageLength: { $size: '$postImage' }, // postImage 배열의 길이를 계산
                        postCategory: 1,
                        postWriter: 1,
                        postWriterProfileImage: 1,
                        postedAt: 1,
                        postContent: 1,
                        likerLength: { $size: '$liker' }, // liker 배열의 길이를 계산
                        commentLength: { $size: '$comment' }, // comment 배열의 길이를 계산
                    },
                },
                { $match: filter }, // 검색 필터 적용
                { $sort: { likerLength: -1 } }, // likerLength 필드를 큰 순으로 정렬
                { $skip: startIndex },
                { $limit: perPage },
            ]);
        }
        //댓글순
        else if (sortMode == 3) {
            console.log(sortMode);
            postList = await Post.aggregate([
                {
                    $project: {
                        postId: { $toString: '$_id' },
                        postTitle: 1,
                        ImageLength: { $size: '$postImage' }, // postImage 배열의 길이를 계산
                        postCategory: 1,
                        postWriter: 1,
                        postWriterProfileImage: 1,
                        postedAt: 1,
                        postContent: 1,
                        likerLength: { $size: '$liker' }, // liker 배열의 길이를 계산
                        commentLength: { $size: '$comment' }, // comment 배열의 길이를 계산
                    },
                },
                { $match: filter }, // 검색 필터 적용
                { $sort: { commentLength: -1 } }, // commentLength 필드를 큰 순으로 정렬
                { $skip: startIndex },
                { $limit: perPage },
            ]);
        }
        //디폴트, 최신순
        else {
            let responseList = [];

            responseList = await Post.find(filter) // filter를 find 메서드로 전달
                .sort({ postedAt: -1 }) // String 형태의 날짜를 Date 타입으로 변환하여 최신순으로 정렬
                .skip(startIndex)
                .limit(perPage);

            responseList.map((item, idx) => {
                postList.push({
                    postId: item._id.toString(),
                    postTitle: item.postTitle,
                    ImageLength: item.postImage.length,
                    postCategory: item.postCategory,
                    postWriter: item.postWriter,
                    postWriterProfileImage: item.postWriterProfileImage,
                    postedAt: item.postedAt,
                    postContent: item.postContent,
                    likerLength: item.liker.length,
                    commentLength: item.comment.length,
                });
            });
        }

        //const postList = await Post.find();

        if (!postList || postList.length === 0) {
            return res.status(404).json({ message: '저장된 게시글이 없습니다.' });
        }

        res.status(201).json(postList);
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

            const postCategory = req.body.hasOwnProperty('postCategory') ? req.body.postCategory : 1;

            const newPost = new Post({
                postTitle: postTitle,
                postContent: postContent,
                postImage: postImage,
                postWriter: postWriter.userName,
                postWriterUserId: postWriter._id.toString(),
                postWriterProfileImage: postWriter.userProfileImage,
                postedAt: postedAt,
                postCategory: postCategory,
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

                    //댓글 작성자와 게시물 작성자가 다르면, 게시물 작성자에게 댓글 알림 보내주기
                    if (post.postWriterUserId !== comment.commentWriterUserId) {
                        sendNotificationToPostWriter(post, comment, commentWriter);
                    }

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

// 댓글 추가시 게시물 작성자, 댓글 작성자에게 푸시 알림 보내기 ( 본인 댓글 제외 )
async function sendNotificationToPostWriter(post, comment, recentCommentWriter) {
    try {
        const postWriter = await User.findOne({ _id: post.postWriterUserId });

        let fcmTokenList = [recentCommentWriter.fcmToken]; // 최근에 댓글 단 사람에게는 알림 안가게

        if (!postWriter) {
            console.error('게시물 작성자를 찾을 수 없습니다.');
            //return;//한명 못찾아도 댓글 작성자들은 보내야 함
        }

        if (postWriter && postWriter.fcmToken && !fcmTokenList.includes(postWriter.fcmToken)) {
            const payload = {
                notification: {
                    title: '새로운 댓글이 달렸어요',
                    body: comment.commentContent,
                    //image: 'https://danim.me/square_logo.png', // 이미지 URL을 여기에 추가
                },
                data: {
                    // 여기에 필요한 데이터를 추가할 수 있습니다.
                    // 예: noteId, senderId 등
                },
                token: postWriter.fcmToken,
            };
            await admin.messaging().send(payload);

            fcmTokenList.push(postWriter.fcmToken);
        }

        //댓글작성자들에게도 알림 보내기
        post.comment.map(async (item, idx) => {
            let commentWriter = await User.findOne({ _id: item.commentWriterUserId });

            if (!commentWriter) {
                console.error('댓글 작성자를 찾을 수 없습니다.');
                //return;//한명 못찾아도 뒷 사람들은 보내야 함
            }

            //만약 fcmTokenList에 있는데 알림 또 보내면 중복
            if (commentWriter && commentWriter.fcmToken && !fcmTokenList.includes(commentWriter.fcmToken)) {
                const payload = {
                    notification: {
                        title: '새로운 댓글이 달렸어요',
                        body: comment.commentContent,
                        //image: 'https://danim.me/square_logo.png', // 이미지 URL을 여기에 추가
                    },
                    data: {
                        // 여기에 필요한 데이터를 추가할 수 있습니다.
                        // 예: noteId, senderId 등
                    },
                    token: commentWriter.fcmToken,
                };
                await admin.messaging().send(payload);

                fcmTokenList.push(commentWriter.fcmToken);
            }
        });
    } catch (error) {
        console.error('푸시 알림 전송 중 에러:', error);
    }
}

module.exports = router;
