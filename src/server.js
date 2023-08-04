const express = require('express');
const app = express();
const port = Number(process.env.PORT) || 8080;
const mongoose = require('mongoose');
var connect = require('./schemas/index.js'); //이러면, 이 폴더 내부에 있는 index.js가 자동으로 import됨. 그래서 파일 이름이 중요!

var indexRouter = require('./routes/index.js');
connect(); //MongoDB 연결

app.listen(port, () => {
    console.log(`server is listening at localhost:${port}`);
});

app.use(express.json()); // JSON 데이터 파싱을 위한 미들웨어

// 라우팅 설정
app.use('/', indexRouter); // '/' 경로에 대한 라우팅 설정

indexRouter.get('/', (req, res, next) => {
    User.find()
        .then((users) => {
            //res.json(users);
        })
        .catch((err) => {
            console.error(err);
            next(err);
        });
});
