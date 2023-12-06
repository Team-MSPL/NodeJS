const express = require('express');
const router = express.Router();
const Marketing = require('../schemas/marketing.js');
const ManageUser = require('../schemas/manage_user.js');
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
var _ = require('lodash');
require('dotenv').config();

const algorithm = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.CRYPTO_KEY || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // Must be 256 bits (32 characters)
const iv = 'bbbbbbbbbbbbbbbb'; // Initialization Vector (16 바이트)

// 웹 - 마케팅 정보 수집
router.post('/saveMarketing', async (req, res) => {
    try {
        const { name, phoneNum, email, provider } = req.body;

        if (provider === 'phoneNum') {
            const existingPhoneMarketing = await Marketing.findOne({ phoneNum: phoneNum });
            if (existingPhoneMarketing) {
                res.status(405).json({ message: '이미 존재하는 마케팅 정보입니다.' });
            } else {
                const newMarketing = new Marketing({
                    name: name,
                    phoneNum: phoneNum,
                    provider: provider,
                });
                await newMarketing.save();
                res.status(201).json({ message: '마케팅 정보 저장 완료.' });
            }
        } else if (provider === 'email') {
            const existingEmailMarketing = await Marketing.findOne({ email: email });
            if (existingEmailMarketing) {
                res.status(405).json({ message: '이미 존재하는 마케팅 정보입니다.' });
            } else {
                const newMarketing = new Marketing({
                    name: name,
                    email: email,
                    provider: provider,
                });
                await newMarketing.save();
                res.status(201).json({ message: '마케팅 정보 저장 완료.' });
            }
        } else {
            res.status(403).json({ message: 'provider가 잘못되었습니다.' });
        }
    } catch (error) {
        console.log(req.body);
        console.error('/users - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

const couponToken = 3; //쿠폰으로 줄 토큰 갯수

// 쿠폰 사용하기
router.patch('/useCoupon', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { couponCode, functionToken } = req.body;

            let couponInfo = await Marketing.findOne({ name: couponCode });

            if (couponCode !== process.env.COUPON_CODE) {
                res.status(404).json({ message: '잘못된 쿠폰 번호 입니다.' });
                return;
            }

            //쿠폰을 첫 사용할때 - DB 생성
            if (!couponInfo) {
                //분해 하고, 나온 id로
                // Update the travel functionToken
                User.findOneAndUpdate(
                    { _id: decoded._id },
                    { functionToken: functionToken + couponToken },
                    { new: true }
                ) // { new: true }로 리턴값 받기
                    .then((updatedUser) => {
                        if (!updatedUser) {
                            console.log(updatedUser);
                            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                        }
                    })
                    .catch((error) => {
                        return res.status(403).json({ message: '잘못된 functionToken 입니다.' });
                    });

                const newCoupon = new Marketing({
                    name: couponCode.toString(),
                    CouponUsedList: [decoded._id.toString()],
                });
                await newCoupon.save();
                res.status(200).json({ functionToken: functionToken + couponToken });
            }

            //이미 쿠폰 DB가 만들어진 경우
            else {
                const now = new Date(); // 현재 날짜 및 시간
                const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
                const koreaTimeDiff = 9 * 60 * 60 * 1000;
                const korNow = new Date(utc + koreaTimeDiff);
                if (couponInfo.couponEndDate.getTime() <= korNow.getTime()) {
                    return res.status(402).json({ message: '사용 기한이 지난 쿠폰입니다.' });
                }
                // 이미 해당 쿠폰이 사용된 경우, 중복 체크 후 추가
                else if (!couponInfo.CouponUsedList.includes(decoded._id.toString())) {
                    User.findOneAndUpdate(
                        { _id: decoded._id },
                        { functionToken: functionToken + couponToken },
                        { new: true }
                    ) // { new: true }로 리턴값 받기
                        .then((updatedUser) => {
                            if (!updatedUser) {
                                console.log(updatedUser);
                                return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                            }
                        })
                        .catch((error) => {
                            return res.status(403).json({ message: '잘못된 functionToken 입니다.' });
                        });

                    couponInfo.CouponUsedList.push(decoded._id.toString());
                    await couponInfo.save();

                    res.status(200).json({ functionToken: functionToken + couponToken });
                } else {
                    return res.status(400).json({ message: '이미 쿠폰을 사용했습니다.' });
                }
            }

            console.log('!2312312312312321');

            //위에서 return 안되었으면 쿠폰 로그 남김            //manage_user에 로그 추가
            await ManageUser.findOne({ userId: decoded._id.toString() })
                .then(async (manageUser) => {
                    if (!manageUser) {
                        console.log(manageUser);
                        res.status(401).json({ message: 'Unauthorized' });
                        return;
                    }
                    const now = new Date(); // 현재 날짜 및 시간
                    const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
                    const koreaTimeDiff = 9 * 60 * 60 * 1000;
                    const korNow = new Date(utc + koreaTimeDiff);

                    if (!manageUser.tokenLog) {
                        manageUser.tokenLog = [];
                    }

                    manageUser.tokenLog.push({
                        tokenLogContent: '쿠폰 사용',
                        tokenLogNumber: couponToken,
                        tokenLogDate: now.getTime(),
                    });

                    await manageUser.save();
                })
                .catch((error) => {
                    console.error('ManageUser.findOne() 함수에 문제 발생 : ', error);
                    res.status(401).json({ message: 'Unauthorized' });
                    return;
                });
        });
    } catch (error) {
        console.error('/marketing/useCoupon - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 쿠폰 사용하기 ( 웹 사이트 )
router.patch('/useCouponInWeb', async (req, res) => {
    try {
        const { couponCode, encryptedToken } = req.body;

        const decryptedToken = decrypt(encryptedToken);

        let couponInfo = await Marketing.findOne({ name: couponCode });

        if (couponCode !== process.env.COUPON_CODE) {
            res.status(404).json({ message: '잘못된 쿠폰 번호 입니다.' });
            return;
        }
        let user = await User.findOne({ userToken: decryptedToken });

        if (!user) {
            console.log(user);
            return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        //쿠폰을 첫 사용할때 - DB 생성
        if (!couponInfo) {
            //분해 하고, 나온 id로
            // Update the travel functionToken
            User.findOneAndUpdate(
                { userToken: decryptedToken },
                { functionToken: user.functionToken + couponToken },
                { new: true }
            )
                .then(async (updatedUser) => {
                    if (!updatedUser) {
                        console.log(updatedUser);
                        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                    }

                    const newCoupon = new Marketing({
                        name: couponCode.toString(),
                        CouponUsedList: [updatedUser._id.toString()],
                    });
                    await newCoupon.save();
                    res.status(200).json({ functionToken: user.functionToken + couponToken });
                })
                .catch((error) => {
                    return res.status(403).json({ message: '잘못된 functionToken 입니다.' });
                });
        }

        //이미 쿠폰 DB가 만들어진 경우
        else {
            const now = new Date(); // 현재 날짜 및 시간
            const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
            const koreaTimeDiff = 9 * 60 * 60 * 1000;
            const korNow = new Date(utc + koreaTimeDiff);
            if (couponInfo.couponEndDate.getTime() <= korNow.getTime()) {
                return res.status(402).json({ message: '사용 기한이 지난 쿠폰입니다.' });
            }
            // 이미 해당 쿠폰이 사용된 경우, 중복 체크 후 추가
            else if (!couponInfo.CouponUsedList.includes(user._id.toString())) {
                User.findOneAndUpdate(
                    { _id: user._id },
                    { functionToken: user.functionToken + couponToken },
                    { new: true }
                ) // { new: true }로 리턴값 받기
                    .then((updatedUser) => {
                        if (!updatedUser) {
                            console.log(updatedUser);
                            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                        }
                    })
                    .catch((error) => {
                        return res.status(403).json({ message: '잘못된 functionToken 입니다.' });
                    });

                couponInfo.CouponUsedList.push(user._id.toString());
                await couponInfo.save();

                res.status(200).json({ functionToken: user.functionToken + couponToken });
            } else {
                return res.status(400).json({ message: '이미 쿠폰을 사용했습니다.' });
            }
        }

        //위에서 return 안되었으면 쿠폰 로그 남김            //manage_user에 로그 추가
        await ManageUser.findOne({ userId: user._id.toString() })
            .then(async (manageUser) => {
                if (!manageUser) {
                    console.log(manageUser);
                    res.status(401).json({ message: 'Unauthorized' });
                    return;
                }
                const now = new Date(); // 현재 날짜 및 시간
                const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
                const koreaTimeDiff = 9 * 60 * 60 * 1000;
                const korNow = new Date(utc + koreaTimeDiff);

                if (!manageUser.tokenLog) {
                    manageUser.tokenLog = [];
                }

                manageUser.tokenLog.push({
                    tokenLogContent: '쿠폰 사용',
                    tokenLogNumber: couponToken,
                    tokenLogDate: now.getTime(),
                });

                await manageUser.save();
            })
            .catch((error) => {
                console.error('ManageUser.findOne() 함수에 문제 발생 : ', error);
                res.status(401).json({ message: 'Unauthorized' });
                return;
            });
    } catch (error) {
        console.error('/marketing/useCouponInWeb - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//토큰 암호화 ( 대칭키 암호화, crypto )
// function encrypt(text) {
//     const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
//     let encrypted = cipher.update(text, 'utf8', 'hex');
//     encrypted += cipher.final('hex');
//     return encrypted;
// }

//토큰 복호화 ( 대칭키 암호화, crypto )
function decrypt(encrypted) {
    try {
        const secret_key = process.env.CRYPTO_SECRET_KEY; //env키임
        if (!secret_key) {
            console.log('No Secret Key.');
            return null;
        }
        const decrypted_bytes = CryptoJS.AES.decrypt(encrypted, secret_key);
        const decrypted = decrypted_bytes.toString(CryptoJS.enc.Utf8);
        return decrypted;
    } catch (e) {
        console.log('Decryption error occur : ', e);
        return null;
    }
}
module.exports = router;
