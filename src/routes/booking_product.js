const express = require('express');
const router = express.Router();
const SellingProduct = require('../schemas/selling_product.js');
const BookingProduct = require('../schemas/booking_product.js');
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
require('dotenv').config();

var _ = require('lodash');

// 예약 목록 가져오기
router.get('/list', async (req, res) => {
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        try {
            const { country, confirm, s_date, e_date, minCost, maxCost } = req.query;

            //const matchStage = { userId: '67bfe5d2a02da54871ad36d6' };
            const matchStage = {
                userId: decoded._id,
                isActive: { $ne: false }, // 비활성(false)인 예약 제외
            };

            // 예약 확정 여부
            if (confirm === 'true') matchStage.confirm = true;
            if (confirm === 'false') matchStage.confirm = false;

            // 날짜 필터링
            if (s_date) matchStage.s_date = { $gte: new Date(s_date) };
            if (e_date) {
                matchStage.e_date = matchStage.e_date || {};
                matchStage.e_date.$lte = new Date(e_date);
            }

            // 총 비용 필터링
            if (minCost || maxCost) {
                matchStage.total_price = {};
                if (minCost) matchStage.total_price.$gte = parseInt(minCost);
                if (maxCost) matchStage.total_price.$lte = parseInt(maxCost);
            }

            // aggregation pipeline
            const pipeline = [
                { $match: matchStage },
                {
                    $lookup: {
                        from: 'sellingproducts',
                        localField: 'guid',
                        foreignField: '_id',
                        as: 'sellingProduct',
                    },
                },
                {
                    $unwind: {
                        path: '$sellingProduct',
                        preserveNullAndEmptyArrays: true,
                    },
                },
            ];

            // 국가 필터링
            if (country) {
                pipeline.push({
                    $match: {
                        'sellingProduct.sellingProductCountryList': { $in: [country] },
                    },
                });
            }

            const myBookings = await BookingProduct.aggregate(pipeline);
            res.status(200).json(myBookings);
        } catch (error) {
            console.error('/bookingProducts/list - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 예약 하나 가져오기
router.get('/:id', async (req, res) => {
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        try {
            const { id } = req.params;
            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            BookingProduct.findOne({ _id: id })
                .then(async (bookingProduct) => {
                    if (!bookingProduct) {
                        return res.status(404).json({ message: '저장된 판매 상품이 없습니다.' });
                    }

                    res.status(200).json(bookingProduct);
                })
                .catch((error) => {
                    console.error('bookingProduct.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 bookingProductId 입니다.' });
                });
        } catch (error) {
            console.error('/bookingProducts/:id - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 예약 저장하기
router.post('/save', async (req, res) => {
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        try {
            const newBookingProduct = new BookingProduct(req.body);
            const savedBookingProduct = await newBookingProduct.save();

            // await sendPushNotification(decoded._id.toString(), savedBookingProduct._id);

            // await sendEmailToAdmin('wayfarers0814@gmail.com', savedBookingProduct);

            res.status(200).json({ bookingProductId: savedBookingProduct._id });
        } catch (error) {
            console.error('/bookingProduct/save - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 예약 수정하기
router.patch('/:id', async (req, res) => {
    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        try {
            const { id } = req.params;

            // // 업데이트할 필드 목록
            // const updateFields = {};
            // const allowedFields = [
            //     'passportList',
            //     'contact',
            //     's_date',
            //     'e_date',
            //     'personCount',
            //     'totalCost',
            //     'pickupPlace',
            //     'dropPlace',
            //     'request',
            //     'reviewPoint',
            //     'review',
            //     'confirm',
            // ];

            // allowedFields.forEach((field) => {
            //     if (req.body[field] !== undefined) {
            //         updateFields[field] = req.body[field];
            //     }
            // });

            // const updatedBooking = await BookingProduct.findOneAndUpdate(
            //     { _id: id, userId: decoded._id }, // 본인 예약만 수정 가능
            //     { $set: updateFields },
            //     { new: true }
            // );
            const updatedBooking = await BookingProduct.findOneAndUpdate(
                { _id: id, userId: decoded._id }, // 본인 예약만 수정 가능
                { $set: req.body }, // body 전체를 업데이트
                { new: true }
            );

            if (!updatedBooking) {
                return res.status(404).json({ message: '예약을 찾을 수 없거나 권한이 없습니다.' });
            }
            // else {
            //     await sendPushNotification(decoded._id.toString(), savedBookingProduct._id);
            //     await sendEmailToAdmin('wayfarers0814@gmail.com', savedBookingProduct);
            // }

            res.status(200).json(updatedBooking);
        } catch (error) {
            console.error('/bookingProduct/:id - PATCH 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// const sendPushNotification = async (userId, bookingId) => {
//     try {
//         //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
//         User.findOne({ _id: userId })
//             .then(async (user) => {
//                 if (!user) {
//                     console.log(user);
//                     return res.status(404).json({ message: '저장된 유저가 없습니다.' });
//                 }
//                 // 여기서 FCM 푸시 알림 보내기
//                 if (user.fcmToken) {
//                     const payload = {
//                         notification: {
//                             title: '예약이 완료되었습니다!',
//                             body: '고객님, 예약이 정상적으로 저장되었습니다. 예약 확정 시 이메일로 안내드릴 예정입니다.',
//                             //image: 'https://danim.me/square_logo.png', // 이미지 URL을 여기에 추가
//                         },
//                         data: {
//                             type: 'booking_notification',
//                             bookingId: bookingId,
//                             status: 'pending_confirmation',
//                         },
//                         token: user.fcmToken,
//                     };

//                     try {
//                         //await admin.messaging().sendToDevice(user.fcmToken, payload);
//                         await admin.messaging().send(payload);
//                     } catch (error) {
//                         // fcmToken이 유효하지 않은 경우 삭제
//                         if (
//                             error.code === 'messaging/registration-token-not-registered' ||
//                             (error.errorInfo && error.errorInfo.code === 'messaging/registration-token-not-registered')
//                         ) {
//                             console.log('유효하지 않은 FCM 토큰 삭제:', user.fcmToken);
//                             user.fcmToken = null;
//                             await user.save();
//                         } else {
//                             console.error('FCM 전송 에러:', error);
//                         }
//                     }
//                 }
//                 console.log('예약 알림 전송 완료');
//             })
//             .catch((error) => {
//                 console.error('User.findOne() 함수에 문제 발생 : ', error);
//             });
//     } catch (error) {
//         console.error('sendPushNotification 함수에 문제 발생 : ', error);
//     }
// };

// const sendEmailToAdmin = async (toEmail, bookingData) => {
//     const transporter = nodemailer.createTransport({
//         service: 'Gmail',
//         auth: {
//             user: process.env.ADMIN_EMAIL_USER,
//             pass: process.env.ADMIN_EMAIL_PASS,
//         },
//     });

//     const mailOptions = {
//         from: `"예약시스템" <${process.env.EMAIL_USER}>`,
//         to: toEmail,
//         subject: '[예약 확정] 고객님의 여행 예약이 확정되었습니다',
//         html: `
//             <h2>예약이 확정되었습니다!</h2>
//             <p>고객님, 안녕하세요.</p>
//             <p>예약해주신 여행이 확정되어 이메일로 안내드립니다.</p>
//             <ul>
//                 <li>예약번호: <strong>${bookingData._id}</strong></li>
//                 <li>여행기간: ${new Date(bookingData.s_date).toLocaleDateString()} ~ ${new Date(
//             bookingData.e_date
//         ).toLocaleDateString()}</li>
//                 <li>여행 인원: 대인 ${bookingData.personCount.get('대인') || 0}명, 소인 ${
//             bookingData.personCount.get('소인') || 0
//         }명</li>
//                 <li>총 비용: ${bookingData.totalCost?.toLocaleString() || '정보 없음'}원</li>
//             </ul>
//             <p>즐거운 여행 되시길 바랍니다!</p>
//         `,
//     };

//     await transporter.sendMail(mailOptions);
// };

module.exports = router;
