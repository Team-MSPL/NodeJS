const express = require('express');
const app = express();
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');
dotenv.config();
console.log(process.env.PORT);
const port = 3000;
//const url = process.env.URL || 'localhost';
const mongoose = require('mongoose');
var connect = require('./schemas/index.js'); //이러면, 이 폴더 내부에 있는 index.js가 자동으로 import됨. 그래서 파일 이름이 중요!

var indexRouter = require('./routes/index.js');

// EJS 뷰 엔진 설정
app.set('view engine', 'ejs'); // 'ejs'는 설치한 뷰 엔진의 이름
app.set('views', '/home/ubuntu/danim_database/src/views');

// ssl 인증서 관련
// const options = {
//     ca: fs.readFileSync('/etc/letsencrypt/live/danimdatabase.com/fullchain.pem'),
//     key: fs.readFileSync('/etc/letsencrypt/live/danimdatabase.com/privkey.pem'),
//     cert: fs.readFileSync('/etc/letsencrypt/live/danimdatabase.com/cert.pem'),
// };

// https.createServer(options, app).listen(443, () => {
//     console.log(`server is listening on ` + 443);
//     //console.log(`server is listening at ${url}:${port}`);
// });

(async () => {
    await connect(); //MongoDB 연결  }

    app.listen(port, () => {
        console.log(`server is listening on ` + port);
    });
    // Error: listen EADDRINUSE: address already in use :::27017 해결?
    //아래는 포트 번호가 없어서 Error: connect ECONNREFUSED 54.180.92.25:80 뜨는듯?
    // app.listen(() => {
    //     console.log(`server is listening`);
    //     //console.log(`server is listening at ${url}:${port}`);
    // });
    //app.use(express.json());

    // // loader.io 검증 라우트
    // app.get('/loaderio-e330badb94b23dd21f034767014545bd', (req, res) => {
    //     res.send('loaderio-e330badb94b23dd21f034767014545bd');
    // });

    app.use(express.json({ limit: '10mb' })); // JSON 데이터 파싱을 위한 미들웨어

    //////////////////////////////////////////////////////////////////// 해피카 개발용 임시
    let isRunning = false; // 현재 크롤링 실행 여부
    let program = null; // 실행할 크롤러 이름
    let lastResult = null; // 마지막 크롤링 결과 저장

    // 크롤러 상태 반환
    app.get('/status', (req, res) => {
        res.json({
            is_running: isRunning,
            program: program,
        });
    });

    // 크롤러 실행 요청
    app.post('/start', (req, res) => {
        if (isRunning) {
            return res.json({ message: '이미 크롤링이 진행 중입니다.' });
        }

        const { crawler } = req.body;
        if (
            !crawler ||
            (crawler !== 'axa' &&
                crawler !== 'hero' &&
                crawler !== 'hyundai' &&
                crawler !== 'kb' &&
                crawler !== 'meritzfire' &&
                crawler !== 'samsung')
        ) {
            return res.status(400).json({ message: '잘못된 크롤러 이름입니다.' });
        }

        isRunning = true;
        program = crawler;
        res.json({ message: `${crawler} 크롤러 실행 요청됨.` });

        // // 10초 후 실행 완료 상태로 변경 (예제용, 실제 크롤러 실행에 맞춰 수정)
        // setTimeout(() => {
        //     isRunning = false;
        //     program = null;
        // }, 10000);
    });

    // 크롤러 결과 저장
    app.post('/result', (req, res) => {
        lastResult = req.body.data;
        console.log('크롤링 결과 수신:', lastResult);

        if (lastResult === '이미 크롤링 진행 중입니다.') {
            isRunning = true;
            lastResult = null;
        } else {
            isRunning = false;
            program = null;

            res.json({ message: '결과 수신 완료' });
        }
    });

    // 마지막 크롤링 결과 확인
    app.get('/result', (req, res) => {
        if (!lastResult) {
            return res.json({ message: '아직 크롤링 결과가 없습니다.' });
        }
        res.json(lastResult);
    });
    //////////////////////////////////////////////////////////////////// 해피카 개발용 임시

    // 라우팅 설정
    app.use('/', indexRouter); // '/' 경로에 대한 라우팅 설정
})();
