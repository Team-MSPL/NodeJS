const express = require('express');
const router = express.Router();
const https = require('https');
const axios = require('axios');
const User = require('../../schemas/user.js');
const ManageUser = require('../../schemas/manage_user.js');
const fs = require('fs');
require('dotenv').config();

var _ = require('lodash');

const certPath = '/home/ubuntu/danim_database/src/routes/toss/danim-toss-course-mtls_public.crt';
const keyPath = '/home/ubuntu/danim_database/src/routes/toss/danim-toss-course-mtls_private.key';

// 💡 Toss API 호출용 함수 정의
function callTossAPI(callback) {
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

// MTLS를 위한 httpsAgent 선언
const httpsAgent = new https.Agent({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    rejectUnauthorized: true,
});

// Toss AccessToken 발급
async function getAccessToken(authorizationCode, referrer) {
    const response = await axios.post(
        'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/generate-token',
        { authorizationCode, referrer },
        { httpsAgent, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data; // { accessToken, refreshToken, ... }
}

// Toss AccessToken 재발급
async function refreshAccessToken(refreshToken) {
    const response = await axios.post(
        'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/refresh-token',
        { refreshToken },
        { httpsAgent, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data; // { accessToken, refreshToken, ... }
}

// Toss 사용자 정보
async function userInfo(accessToken) {
    const response = await axios.get(
        'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2/login-me',
        {
            httpsAgent,
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );
    return response.data; // { accessToken, refreshToken, ... }
}

// JWT 만료 체크
function isTokenExpired(token) {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return true;
        const now = Math.floor(Date.now() / 1000);
        return decoded.exp <= now;
    } catch (err) {
        return true;
    }
}

// 토스 로그인

router.post('/login', async (req, res) => {
    try {
        const { authorizationCode, referrer, existingRefreshToken } = req.body;
        let tokens;
        let data;

        if (existingRefreshToken) {
            // 기존 RefreshToken으로 AccessToken 재발급
            tokens = await refreshAccessToken(existingRefreshToken);
            tokens = tokens.success;
            //console.log('Final Tokens1:', tokens);
        } else {
            // 새로 AuthorizationCode로 AccessToken 발급
            tokens = await getAccessToken(authorizationCode, referrer);
            tokens = tokens.success;
            //console.log('Final Tokens2:', tokens);
        }

        // AccessToken 만료 여부 체크
        if (isTokenExpired(tokens.accessToken) && tokens.refreshToken) {
            tokens = await refreshAccessToken(tokens.refreshToken);
            tokens = tokens.success;
            //console.log('Final Tokens3:', tokens);
        }

        data = await userInfo(tokens.accessToken);
        res.status(200).json(data);
    } catch (error) {
        console.error('Toss API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
});

// 토스 회원 탈퇴
router.post('/withdraw', async (req, res) => {
    try {
        const { userKey, referrer } = req.body;

        // 사용자 찾기
        const user = await User.findOne({ userToken: userKey });
        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        // // TravelCourse 데이터 삭제
        // await TravelCourse.deleteMany({ user._id });

        // ManageUser 업데이트 or 생성
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
        const korNow = new Date(utc + 9 * 60 * 60 * 1000);

        let manageUser = await ManageUser.findOne({ userId: user._id.toString() });
        if (!manageUser) {
            manageUser = new ManageUser({
                userId: user._id.toString(),
                userToken: user.userToken,
                functionToken: user.functionToken,
                noteList: user.noteList,
                blockUserList: user.blockUserList,
                withdrawReasonList: [],
                withdrawDate: korNow,
            });
            await manageUser.save();
        } else {
            await ManageUser.findOneAndUpdate(
                { _id: manageUser._id },
                {
                    $set: {
                        userId: user._id.toString(),
                        userToken: user.userToken,
                        functionToken: user.functionToken,
                        noteList: user.noteList,
                        blockUserList: user.blockUserList,
                        withdrawDate: korNow,
                    },
                },
                { new: true }
            );
        }

        // User 삭제
        await User.deleteOne({ userToken: userKey });

        res.status(200).json({ message: '토스 회원 탈퇴가 완료되었습니다.' });
    } catch (error) {
        console.error('/withdraw/toss - DELETE 함수 에러:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
