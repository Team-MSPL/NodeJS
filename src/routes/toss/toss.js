const express = require('express');
const router = express.Router();
const https = require('https');
const fs = require('fs');
require('dotenv').config();

var _ = require('lodash');

// 💡 Toss API 호출용 함수 정의
function callTossAPI(callback) {
    const certPath = '/home/ubuntu/danim_database/src/routes/toss/danim-toss-course-mtls_public.crt';
    const keyPath = '/home/ubuntu/danim_database/src/routes/toss/danim-toss-course-mtls_private.key';

    const options = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        rejectUnauthorized: true,
    };

    console.log('Toss API 요청');

    const req = https.request('https://apps-in-toss-api.toss.im/endpoint', { method: 'GET', ...options }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
            console.log('Toss API Response:', data);
            callback(null, data); // 응답을 callback으로 전달
        });
    });

    req.on('error', (e) => {
        console.error('Toss API Error:', e);
        callback(e); // 에러도 callback으로 전달
    });

    req.end();
}

// 라우터에 연결
router.get('/', (req, res) => {
    callTossAPI((err, data) => {
        if (err) {
            res.status(500).json({ message: 'Toss API 호출 실패', error: err.message });
        } else {
            res.status(200).json({ message: 'Toss API 호출 성공', data });
        }
    });
});

module.exports = router;
