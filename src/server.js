//import { localSearchAI, enoughPlace } from './local_search_ai.js';
var { localSearchAI, enoughPlace } = require('./ai/local_search_ai.js');
var { regionSearch } = require('./ai/region_search.js');
//var { test_function_run } = require('./test2.js');
//const { Worker, isMainThread, parentPort } = require('worker_threads');
//const path = require('path');
const express = require('express');
const app = express();
const port = Number(process.env.PORT) || 8080;
const mongoose = require('mongoose');
var connect = require('./Schemas'); //이러면, 이 폴더 내부에 있는 index.js가 자동으로 import됨. 그래서 파일 이름이 중요!
connect();

let firstTime = true;

// // MongoDB에 연결
// mongoose.connect('mongodb://localhost/danim_database', { useNewUrlParser: true, useUnifiedTopology: true });

// const db = mongoose.connection;

// const handleOpen = () => console.log('✅ Connected to DB');
// const handleError = () => console.log('❌ DB error', error);
// db.on('error', handleError);
// db.once('open', handleOpen);

app.listen(port, () => {
    console.log(`server is listening at localhost:${port}`);
    //mongodb://이름:비밀번호@localhost:27017/admin
    // mongoose.connect('mongodb://root:1234@localhost:27017/admin', {
    //     dbName: 'danim_database',
    //     useNewUrlParser: true,
    //     userCreateIndex: true,
    // });
    //console.log(`server is listening at localhost:${process.env.PORT}`);
});

app.use(express.json()); // JSON 데이터 파싱을 위한 미들웨어

app.get('/ai', async (req, res) => {
    // 클라이언트로부터 전달된 JSON 데이터
    const requestData = req.query.data;

    if (!firstTime) {
        firstTime = true;
        console.log('파비콘땜에 두번 실행됨');
    } else {
        try {
            // JSON 데이터 파싱
            const jsonData = JSON.parse(requestData);

            // 파싱된 데이터를 이용하여 처리 로직 수행

            // 3. 콘솔화면에 로그 시작 부분을 출력
            console.log('--- log start ---');

            const resultData = await localSearchAI({
                regionList: jsonData['regionList'],
                accomodationList: jsonData['accomodationList'],
                selectList: jsonData['selectList'],
                essentialPlaceList: jsonData['essentialPlaceList'],
                timeLimitArray: jsonData['timeLimitArray'],
                nDay: jsonData['nDay'],
                transit: jsonData['transit'],
                distanceSensitivity: jsonData['distanceSensitivity'],
            });
            console.log('--- log end ---');
            firstTime = false;

            // 이 예제에서는 그대로 JSON 데이터를 응답으로 보내줍니다.
            res.json({ success: true, resultData: resultData, enoughPlace: enoughPlace });
            //res.send('ai success' + jsonData);
        } catch (error) {
            // JSON 파싱 에러 처리
            res.status(400).json({ success: false, error: 'Invalid JSON data' });
        }
    }
});

app.get('/regionSearch', async (req, res) => {
    // 클라이언트로부터 전달된 JSON 데이터
    const requestData = req.query.data;

    if (!firstTime) {
        firstTime = true;
        console.log('파비콘땜에 두번 실행됨');
    } else {
        try {
            // JSON 데이터 파싱
            const jsonData = JSON.parse(requestData);

            // 파싱된 데이터를 이용하여 처리 로직 수행

            // 3. 콘솔화면에 로그 시작 부분을 출력
            console.log('--- log start ---');

            const resultData = await regionSearch({
                selectList: jsonData['selectList'],
                selectPopular: jsonData['selectPopular'],
                recentPosition: jsonData['recentPosition'],
                distanceSensitivity: jsonData['distanceSensitivity'],
            });

            console.log('--- log end ---');
            firstTime = false;

            // 이 예제에서는 그대로 JSON 데이터를 응답으로 보내줍니다.
            res.json({ success: true, resultData: resultData });
            //res.send('ai success' + jsonData);
        } catch (error) {
            // JSON 파싱 에러 처리
            console.log(error);
            res.status(400).json({ success: false, error: 'Invalid JSON data' });
        }
    }
});
