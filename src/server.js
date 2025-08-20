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
const options = {
    ca: fs.readFileSync('/etc/letsencrypt/live/danimdatabase.com/fullchain.pem'),
    key: fs.readFileSync('/etc/letsencrypt/live/danimdatabase.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/danimdatabase.com/cert.pem'),
};

(async () => {
    try {
        await connect(); // MongoDB 연결 성공해야만 서버 실행
        console.log('✅ MongoDB connected');

        app.use(express.json({ limit: '10mb' }));
        app.use('/', indexRouter);

        https.createServer(options, app).listen(443, () => {
            console.log(`HTTPS server listening on 443`);
        });
        // 개발용 포트 따로 쓰고 싶으면:
        //app.listen(3000, () => console.log(`HTTP server on 3000`));
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err);
        process.exit(1);
    }
})();
