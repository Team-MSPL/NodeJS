const express = require('express');
const router = express.Router();
const Comment = require('../schemas/comment');

// 사용자의 댓글 전체 조회
router.get('/:id', (req, res, next) => {
    Comment.find({ commenter: req.params.id })
        .then((users) => {
            res.json(users);
        })
        .catch((err) => {
            console.error(err);
            next(err);
        });
});

// 댓글 생성
router.post('/', (req, res, next) => {
    const post = new Comment({
        commenter: req.body.id,
        comment: req.body.comment,
    });
    post.save()
        .then((result) => {
            res.json(result);
        })
        .catch((err) => {
            console.error(err);
            next(err);
        });
});

// 댓글 수정
router.patch('/:id', (req, res, next) => {
    // id의 댓글을 수정해라
    Comment.update({ id: req.params.id }, { comment: req.body.comment })
        .then((result) => {
            res.json(result);
        })
        .catch((err) => {
            console.error(err);
            next(err);
        });
});

// 댓글 삭제
router.delete(':/id', (req, res, next) => {
    Comment.remove({ id: req.params.id })
        .then((result) => {
            res.json(result);
        })
        .catch((err) => {
            console.error(err);
            next(err);
        });
});

module.exports = router;
