//import { localSearchAI, enoughPlace } from './local_search_ai.js';
var { localSearchAI, enoughPlace } = require('./local_search_ai.js');
//var { test_function_run } = require('./test2.js');
//const { Worker, isMainThread, parentPort } = require('worker_threads');
//const path = require('path');
const express = require('express');
const app = express();
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
    { name: '', lat: 35.333, lng: 122.32323, takenTime: 30, category: 4 },
    { name: '', lat: 35.333, lng: 122.32323, takenTime: 30, category: 4 },
    { name: '', lat: 35.333, lng: 122.32323, takenTime: 30, category: 4 },
    { name: '', lat: 34.333, lng: 121.32323, takenTime: 30, category: 4 },
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

app.use(express.json()); // JSON 데이터 파싱을 위한 미들웨어

app.get('/ai/data', async (req, res) => {
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

            await localSearchAI({
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
            res.json({ success: true, data: jsonData });
            //res.send('ai success' + jsonData);
        } catch (error) {
            // JSON 파싱 에러 처리
            res.status(400).json({ success: false, error: 'Invalid JSON data' });
        }
    }
});
