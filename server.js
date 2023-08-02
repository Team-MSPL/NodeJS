//import { localSearchAI, enoughPlace } from './local_search_ai.js';
var { localSearchAI, enoughPlace } = require('./local_search_ai.js');
//var { test_function_run } = require('./test2.js');
//const { Worker, isMainThread, parentPort } = require('worker_threads');
//const path = require('path');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
//const userRoute = require('./api/routes/user');
const router = express.Router();
const port = Number(process.env.PORT) || 8080;

var http = require('http');

let firstTime = true;

//const { localSearchAI, enoughPlace } = require('./local_search_ai');

//이태운 - 임시 데이터
const regionList = ['서울 전체'];
const selectList = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0],
];
const selectListInRegion = [
    [0, 1, 0, 0, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 1, 0, 1, 1, 0, 1, 1],
    [0, 1, 1, 0],
];
const accomodationList = [
    { name: '', selectList: selectList, lat: 35.333, lng: 122.32323, takenTime: 30, category: 4 },
    { name: '', selectList: selectList, lat: 35.333, lng: 122.32323, takenTime: 30, category: 4 },
    { name: '', selectList: selectList, lat: 35.333, lng: 122.32323, takenTime: 30, category: 4 },
    { name: '', selectList: selectList, lat: 34.333, lng: 121.32323, takenTime: 30, category: 4 },
];
const essentialPlaceList = [
    {
        day: 1,
        name: '필수여행지1',
        lat: 35.51243,
        lng: 127.5436,
        category: 5,
        takenTime: 60,
        id: 1,
    },
    {
        day: 2,
        name: '필수여행지2',
        lat: 35.12221,
        lng: 127.6234,
        category: 5,
        takenTime: 60,
        id: 1,
    },
];
const timeLimitArray = [10, 20];
const nDay = 2;
const transit = 1;

const distanceSensitivity = 2; // 거리민감도
//이태운 - 임시 데이터

// 1. 요청한 url을 객체로 만들기 위해 url 모듈사용
var url = require('url');
// 2. 요청한 url 중에 Query String 을 객체로 만들기 위해 querystring 모듈 사용
var querystring = require('querystring');

app.listen(port, () => {
    console.log(`server is listening at localhost:${port}`);
    //console.log(`server is listening at localhost:${process.env.PORT}`);
});

// Get users
router.get('/', (req, res, next) => {
    res.status(200).json(users);
});

app.get('/', async (req, res) => {
    if (!firstTime) {
        firstTime = true;
        console.log('파비콘땜에 두번 실행됨');
    } else {
        // 3. 콘솔화면에 로그 시작 부분을 출력
        console.log('--- log start ---');

        await localSearchAI({
            regionList: regionList,
            accomodationList: accomodationList,
            selectList: selectList,
            essentialPlaceList: essentialPlaceList,
            timeLimitArray: timeLimitArray,
            nDay: nDay + 1,
            transit: transit,
            distanceSensitivity: distanceSensitivity,
        });
        //.catch((err) => console.error('멀티스레딩 중에 에러 발생 ' + err));

        // console.time('prime2');
        //const primeGeneratorPath = path.join('./test.js');
        //await test_function_run().catch((err) => console.error('멀티스레딩 중에 에러 발생 ' + err));

        //console.timeEnd('prime2');
        // 4. 브라우저에서 요청한 주소를 parsing 하여 객체화 후 출력
        //var parsedUrl = url.parse(request.url);
        //console.log(parsedUrl);
        // 5. 객체화된 url 중에 Query String 부분만 따로 객체화 후 출력
        //var parsedQuery = querystring.parse(parsedUrl.query, '&', '=');
        //console.log(parsedQuery);
        // 6. 콘솔화면에 로그 종료 부분을 출력
        console.log('--- log end ---');

        // response.writeHead(200, { 'Content-Type': 'text/html' });
        // response.end('Hello node.js!!');
        // response.writeHead(200, { 'Content-Type': 'text/html' });
        //response.end('var1 :  ' + parsedQuery.var1);
        firstTime = false;
    }
    res.json({
        success: true,
    });
});
/*
var server = http.createServer(async function (request, response) {
    if (!firstTime) {
        firstTime = true;
        console.log('파비콘땜에 두번 실행됨');
    } else {
        // 3. 콘솔화면에 로그 시작 부분을 출력
        console.log('--- log start ---');

        await localSearchAI({
            regionList: regionList,
            accomodationList: accomodationList,
            selectList: selectList,
            essentialPlaceList: essentialPlaceList,
            timeLimitArray: timeLimitArray,
            nDay: nDay + 1,
            transit: transit,
            distanceSensitivity: distanceSensitivity,
        });
        //.catch((err) => console.error('멀티스레딩 중에 에러 발생 ' + err));

        // console.time('prime2');
        //const primeGeneratorPath = path.join('./test.js');
        //await test_function_run().catch((err) => console.error('멀티스레딩 중에 에러 발생 ' + err));

        //console.timeEnd('prime2');
        // 4. 브라우저에서 요청한 주소를 parsing 하여 객체화 후 출력
        var parsedUrl = url.parse(request.url);
        //console.log(parsedUrl);
        // 5. 객체화된 url 중에 Query String 부분만 따로 객체화 후 출력
        var parsedQuery = querystring.parse(parsedUrl.query, '&', '=');
        //console.log(parsedQuery);
        // 6. 콘솔화면에 로그 종료 부분을 출력
        console.log('--- log end ---');

        // response.writeHead(200, { 'Content-Type': 'text/html' });
        // response.end('Hello node.js!!');
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('var1 :  ' + parsedQuery.var1);
        firstTime = false;
    }
});

server.listen(8080, function () {
    console.log('Server is running...');
});
*/
