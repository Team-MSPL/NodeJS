const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();
console.log(process.env.PORT);
const port = 3000;
const url = process.env.URL || 'localhost';
const mongoose = require('mongoose');
var connect = require('./schemas/index.js'); //이러면, 이 폴더 내부에 있는 index.js가 자동으로 import됨. 그래서 파일 이름이 중요!

var indexRouter = require('./routes/index.js');
connect(); //MongoDB 연결

// EJS 뷰 엔진 설정
app.set('view engine', 'ejs'); // 'ejs'는 설치한 뷰 엔진의 이름
app.set('views', './views');

app.listen(port, () => {
    console.log(`server is listening on ` + port);
    //console.log(`server is listening at ${url}:${port}`);
});
// Error: listen EADDRINUSE: address already in use :::27017 해결?
//아래는 포트 번호가 없어서 Error: connect ECONNREFUSED 54.180.92.25:80 뜨는듯?
// app.listen(() => {
//     console.log(`server is listening`);
//     //console.log(`server is listening at ${url}:${port}`);
// });
//app.use(express.json());
app.use(express.json({ limit: '10mb' })); // JSON 데이터 파싱을 위한 미들웨어

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
