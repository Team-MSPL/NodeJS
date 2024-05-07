const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // jsonwebtoken 라이브러리 추가
const User = require('../schemas/user.js');
const TravelCourse = require('../schemas/travel_course.js');
const admin = require('firebase-admin');
const cron = require('node-cron');
require('dotenv').config();

// 1. 여행 코스 목록 가져오기 ( 메인 화면 + 내 여행 목록 )
router.get('/travelList', async (req, res) => {
    // 클라이언트에서 전달한 JWT 토큰 추출
    //console.log(req.header('Authorization'));

    const token = req.header('Authorization').split(' ')[1];

    // JWT 토큰 검증
    //dotenv.config(); // .env 파일의 환경 변수 로드

    jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
        if (err) {
            console.error('JWT 토큰 검증 에러:', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // JWT 토큰 검증 성공 시 요청 처리
        try {
            const { userId } = req.query;

            //여러개를 찾아, List로 묶어서 주는 함수 - find!

            //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
            TravelCourse.find({
                $or: [{ userId: userId }, { sharedUserList: userId }], //sharedUserList도 체크, sharedUserList 필드가 없는 경우 해당 조건은 거짓으로 간주되어 무시
            })
                .select('travelName region day nDay')
                .sort({ 'day.0': -1 }) // day 배열의 첫 번째 원소값을 기준으로 내림차순 정렬
                .then((travelCourseList) => {
                    if (!travelCourseList || travelCourseList.length === 0) {
                        return res.status(404).json({ message: '저장된 여행이 없습니다.' });
                    }

                    res.status(201).json({
                        travelCourseList: travelCourseList,
                    });
                })
                .catch((error) => {
                    console.error('TravelCourse.find() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 userId 입니다.' });
                });
        } catch (error) {
            console.error('/travelCourse - GET 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    });
});

// 2. 여행 코스 하나 가져오기
router.get('/getOneTravelCourse', async (req, res) => {
    // JWT 토큰 필요 X
    try {
        const { travelId } = req.query;

        //find시 발생하는 문제를 처리하려면 이렇게 에러처리 두 번!
        TravelCourse.findOne({ _id: travelId }) //travelId를 저장해둔 것이 아니라, _id를 찾는거임
            .select('travelName region day nDay transit tendency timetable diary picture reviewCheck')
            .then((travelCourse) => {
                if (!travelCourse) {
                    console.log(travelCourse);
                    return res.status(404).json({ message: '저장된 여행이 없습니다.' });
                }

                res.status(201).json(travelCourse);
            })
            .catch((error) => {
                console.error('TravelCourse.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 travelId 입니다.' });
            });
    } catch (error) {
        console.error('/travelCourse - GET 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. 여행 코스 저장하기 ( !!타임테이블 생성시 )
router.post('/saveTravelCourse', async (req, res) => {
    try {
        // 클라이언트에서 전달한 JWT 토큰 추출
        const token = req.header('Authorization').split(' ')[1];

        // JWT 토큰 검증
        //dotenv.config(); // .env 파일의 환경 변수 로드

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // JWT 토큰 검증 성공 시 요청 처리

            const { travelName, userId, region, day, nDay, transit, tendency, timetable } = req.body;

            const newTravelCourse = new TravelCourse({
                travelName,
                userId,
                region,
                day,
                nDay,
                transit,
                tendency,
                timetable,
            });

            const savedTravelCourse = await newTravelCourse.save();

            res.status(201).json({
                travelId: savedTravelCourse._id.toString(),
            });
        });
    } catch (error) {
        console.error('/travelCourse - POST 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 4. 여행 코스 수정하기 ( !!저장버튼 클릭시 ) (PATCH)
router.patch('/updateTravelCourse', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        //dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { travelId, timetable } = req.body; // 수정할 필드들을 담은 객체

            // Update the travel course
            TravelCourse.findOneAndUpdate({ _id: travelId }, { timetable: timetable }, { new: true }) // { new: true }로 리턴값 받기
                .then((updatedTravelCourse) => {
                    if (!updatedTravelCourse) {
                        console.log(updatedTravelCourse);
                        return res.status(404).json({ message: '수정할 여행 코스를 찾을 수 없습니다.' });
                    }

                    //res.status(201).json(travelCourse);
                    res.status(201).json({ message: '여행 코스 수정 완료.' });
                })
                .catch((error) => {
                    console.error('TravelCourse.findOneAndUpdate() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 travelId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/travelCourse - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 4-2. 여행 코스 제목 수정하기
router.patch('/updateTravelCourseName', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        //dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { travelId, updateTravelName } = req.body; // 수정할 필드들을 담은 객체

            // Update the travel course
            TravelCourse.findOneAndUpdate({ _id: travelId }, { travelName: updateTravelName }, { new: true }) // { new: true }로 리턴값 받기
                .then((updatedTravelCourse) => {
                    if (!updatedTravelCourse) {
                        console.log(updatedTravelCourse);
                        return res.status(404).json({ message: '수정할 여행 코스를 찾을 수 없습니다.' });
                    }

                    //res.status(201).json(travelCourse);
                    res.status(201).json({ message: '여행 코스 제목 수정 완료.' });
                })
                .catch((error) => {
                    console.error('TravelCourse.findOneAndUpdate() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 travelId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/travelCourse - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 4-3. 여행 코스 공유자 추가하기
router.patch('/updateSharedUserList', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        //dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { travelId } = req.body;

            TravelCourse.findOne({ _id: travelId }) //postId를 저장해둔 것이 아니라, _id를 찾는거임
                .then(async (updatedTravelCourse) => {
                    if (!updatedTravelCourse) {
                        console.log(updatedTravelCourse);
                        return res.status(404).json({ message: '수정할 여행 코스를 찾을 수 없습니다.' });
                    }

                    if (
                        updatedTravelCourse.sharedUserList.includes(decoded._id.toString()) ||
                        updatedTravelCourse.userId === decoded._id.toString()
                    ) {
                        res.status(202).json({ message: '이미 존재하는 공유자입니다.' });
                    } else {
                        //배열을 받아와서 그대로 저장하면, 여러곳에서 동시에 커뮤니티를 할 경우, 업데이트 문제가 생길 수 있음. 그래서 push
                        updatedTravelCourse.sharedUserList.push(decoded._id.toString());

                        await updatedTravelCourse.save();

                        res.status(201).json({ message: '여행 코스 공유자 목록 수정 완료.' });
                    }
                })
                .catch((error) => {
                    console.error('TravelCourse.findOne() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 travelId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/travelCourse - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 5. 여행 일기 저장, 수정하기 (PATCH)
router.patch('/updateDiary', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        //dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { travelId, diary, picture } = req.body; // 수정할 필드들을 담은 객체

            // Update the travel course
            TravelCourse.findOneAndUpdate({ _id: travelId }, { diary: diary, picture: picture }, { new: true }) // { new: true }로 리턴값 받기
                .then((updatedTravelCourse) => {
                    if (!updatedTravelCourse) {
                        console.log(updatedTravelCourse);
                        return res.status(404).json({ message: '수정할 여행 일기를 찾을 수 없습니다.' });
                    }

                    //res.status(201).json(travelCourse);
                    res.status(201).json({ message: '여행 일기 수정 완료.' });
                })
                .catch((error) => {
                    console.error('TravelCourse.findOneAndUpdate() 함수에 문제 발생 : ', error);
                    res.status(403).json({ message: '잘못된 travelId 입니다.' });
                });
        });
    } catch (error) {
        console.error('/travelCourse - PATCH 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 6. 여행 코스 삭제하기 or 주소유자 변경
router.delete('/deleteTravelCourse', async (req, res) => {
    try {
        const token = req.header('Authorization').split(' ')[1];

        //dotenv.config();

        jwt.verify(token, '${process.env.SECRET_KEY}', async (err, decoded) => {
            if (err) {
                console.error('JWT 토큰 검증 에러:', err);
                return res.status(401).json({ message: 'Unauthorized' });
            }
            // console.log(req.body);
            const { travelId } = req.body;

            // Delete the travel course
            const deletedTravelCourse = await TravelCourse.findOne({ _id: travelId });

            if (!deletedTravelCourse) {
                return res.status(404).json({ message: '삭제할 여행 코스를 찾을 수 없습니다.' });
            }

            if (!deletedTravelCourse.sharedUserList || deletedTravelCourse.sharedUserList.length === 0) {
                deletedTravelCourse.deleteOne({ _id: travelId });
                res.status(200).json({ message: '여행 코스 삭제 완료.' });
            } else {
                //삭제하려는 유저가 주 소유자인 경우
                if (decoded._id.toString() === deletedTravelCourse.userId) {
                    //공유자 리스트 맨 뒤에 있던 사람이 주소유자가 됨 ( 어차피 누가 주소유자인지 유저는 알 방법이 없고, 영향도 없음 )
                    deletedTravelCourse.userId = sharedUserList.at(-1);
                    await deletedTravelCourse.save();
                    res.status(201).json({ message: '여행 코스 주소유자 변경 완료.' });
                }
                //삭제하려는 유저가 주 소유자가 아닐 경우 - sharedUserList에서 삭제
                else {
                    let beforeLength = deletedTravelCourse.sharedUserList.length;

                    //배열 필터링을 통해 삭제
                    deletedTravelCourse.sharedUserList = deletedTravelCourse.sharedUserList.filter(
                        (item) => item !== decoded._id.toString()
                    );

                    if (beforeLength === deletedTravelCourse.sharedUserList.length) {
                        return res.status(405).json({ message: '삭제할 소유자가 없습니다.' });
                    } else {
                        deletedTravelCourse.save();
                        res.status(202).json({ message: '여행 코스 소유자 목록에서 유저 제거 완료.' });
                    }
                }
            }
        });
    } catch (error) {
        console.error('/travelCourse - DELETE 함수에 문제 발생 : ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//7. 여행 지역 선택 분포도 확인하기
router.get('/regionCount', async (req, res) => {
    const password = req.query.password || 'wrong';

    if (password !== process.env.ADMIN_KEY) {
        res.status(404).json({ message: '비밀번호가 틀림' });
        return;
    }

    try {
        const result = await TravelCourse.aggregate([
            {
                $unwind: '$region', // 배열을 풀어낸다
            },
            {
                $group: {
                    _id: '$region',
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    region: '$_id',
                    count: 1,
                },
            },
            {
                $sort: { region: 1 }, // 선택적으로 지역명으로 정렬
            },
        ]);

        res.status(200).json(result);
    } catch (error) {
        console.error('API에서 집계 쿼리 중 에러:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// cron 표현식: 매일 18시에 실행 (18시 0분 0초)
cron.schedule(
    //'0 0 18 * * *',
    '0 0 18 * * *',
    async () => {
        try {
            // 내일 날짜 계산
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(3, 0, 0, 0); // 내일 03:00:00 - 여행 코스 스키마 day 배열 내의 뒷부분 값이 다 이렇게 되어 있음

            let matchingTravelCourses = await TravelCourse.find({
                'day.0': tomorrow.toISOString(),
            });

            // 조회된 여행 코스에 대해 푸시 알림을 보내는 함수 호출
            matchingTravelCourses.forEach((travelCourse) => {
                sendNotificationOnPreviousDay(travelCourse._id);
            });

            console.log(tomorrow.toISOString());
            console.log(matchingTravelCourses.length);
            console.log('Scheduled task completed successfully. - 여행 전날 알림');

            // 오늘 날짜 계산
            const today = new Date();
            today.setHours(3, 0, 0, 0); // 어제 03:00:00 - 여행 코스 스키마 day 배열 내의 뒷부분 값이 다 이렇게 되어 있음
            const yesterdayToString = today.toISOString();

            // matchingTravelCourses = await TravelCourse.find({
            //     $expr: {
            //         $eq: [{ $arrayElemAt: ['$day', -1] }, today.toISOString()],
            //     },
            // });

            // TODO 업데이트 후 바꾸기 - 위에거로
            let travelCourses = await TravelCourse.find();

            matchingTravelCourses = [];

            travelCourses.map((item, idx) => {
                if (item.day[item.nDay - 1] === today.toISOString()) {
                    // console.log(item.day[item.nDay - 1]);
                    // console.log(item.nDay - 1);
                    matchingTravelCourses.push(item);
                }
            });
            // TODO 업데이트 후 바꾸기 - 위에거로

            // 조회된 여행 코스에 대해 푸시 알림을 보내는 함수 호출
            matchingTravelCourses.forEach((travelCourse) => {
                sendNotificationOnAfterDay(travelCourse._id);
            });

            console.log(yesterdayToString);
            console.log(matchingTravelCourses.length);
            console.log('Scheduled task completed successfully. - 여행 종료날 알림');
        } catch (error) {
            console.error('Error in scheduled task:', error);
        }
    },
    {
        scheduled: true,
        timezone: 'Asia/Seoul', // 시간대 설정
    }
);

// 여행 일정 전날에 푸시 알림 보내기
async function sendNotificationOnPreviousDay(travelCourseId) {
    try {
        const travelCourse = await TravelCourse.findById(travelCourseId);

        if (!travelCourse) {
            console.error('여행 코스를 찾을 수 없습니다.');
            return;
        }

        const userId = travelCourse.userId;
        const user = await User.findOne({ _id: userId });

        if (user && user.fcmToken) {
            const payload = {
                notification: {
                    title: '예정된 여행 일정 안내',
                    body: '계획하신 여행 일정이 내일 시작됩니다. 다님과 함께 즐거운 여행 되시길 바랍니다!',
                    //image: 'https://danim.me/square_logo.png', // 이미지 URL을 여기에 추가
                },
            };

            await admin.messaging().sendToDevice(user.fcmToken, payload);
        }
        // }
    } catch (error) {
        console.error('푸시 알림 전송 중 에러:', error);
    }
}

// 여행 일정 종료날에 푸시 알림 보내기
async function sendNotificationOnAfterDay(travelCourseId) {
    try {
        const travelCourse = await TravelCourse.findById(travelCourseId);

        if (!travelCourse) {
            console.error('여행 코스를 찾을 수 없습니다.');
            return;
        }

        const userId = travelCourse.userId;
        const user = await User.findOne({ _id: userId });

        if (user && user.fcmToken) {
            const payload = {
                notification: {
                    title: '여행은 어떠셨나요?',
                    body: '앱 내에서 리뷰를 남겨주신다면, 다님에게 큰 힘이 될거에요!',
                    //image: 'https://danim.me/square_logo.png', // 이미지 URL을 여기에 추가
                },
            };

            await admin.messaging().sendToDevice(user.fcmToken, payload);
        }
        // }
    } catch (error) {
        console.error('푸시 알림 전송 중 에러:', error);
    }
}

module.exports = router;
