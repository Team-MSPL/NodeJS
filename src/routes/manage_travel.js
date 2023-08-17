const express = require('express');
const router = express.Router();
const ManageTravel = require('../schemas/manage_travel.js');
const TravelCourse = require('../schemas/travel_course.js');
const { database } = require('./firebase/firebase_options.js');
var { readAllPlace, readOnePlace } = require('./firebase/firebase_read_place.js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

var _ = require('lodash');

// 여행 리뷰 & 별점 저장하기
router.post('/reviewAndPoint', async (req, res) => {
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
        try {
            const { travelId, review, point, tendencyPoint } = req.body;

            //TravelCourse 스키마에서 리뷰 유무 업데이트

            let saveTravelCourse = await TravelCourse.findOneAndUpdate({ _id: travelId }, { reviewCheck: true })
            .catch((error) => {
                console.error('TravelCourse.findOneAndUpdate() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 travelId 입니다.' });
                return;
            });

            console.log(saveTravelCourse);

            // 여행 코스에 대한 별점과 리뷰 정보 저장
            const newReview = new ManageTravel({
                userId: decoded._id,
                travelId: travelId,
                review: review,
                point: point,
                tendencyPoint: tendencyPoint,
                region: saveTravelCourse.region,
                day: saveTravelCourse.day,
                nDay: saveTravelCourse.nDay,
                tendency: saveTravelCourse.tendency,
                timetable: saveTravelCourse.timetable,
            });

            //DB에 저장
            await newReview.save();

            //파이어베이스에서 데이터셋 업데이트
            if (point !== -1 || tendencyPoint.length !== 0) {
                // TODO 정식 오픈때 주석처리 해제. 디버깅하는 동안 데이터셋 유지
                //await updatePoint(point, tendencyPoint, region, tendency, timetable);
            }

            res.status(201).json({ message: '여행 리뷰 및 별점 저장 완료.' });

            //내가 찾아서 하는게 아니라, 클라이언트에서 보내주는 것이 맞다
            // TravelCourse.findOne({ _id: travelId })
        } catch (error) {
            console.error('/ManageTravel/reviewAndPoint - POST 함수에 문제 발생 : ', error);
            res.status(500).json({ message: 'leternal server error' });
        }
    });
});

async function updatePoint(point, tendencyPoint, region, tendency, timetable) {
    let readPlaceList = [];
    let readPlaceList2 = [];

    //평점 안남겼을 경우 처리
    const defaultPoint = 4; //평점을 안남겼을 경우, 이 값을 적용시켜 점수가 변동이 없게함 ( 4점 )

    if (point === -1) {
        point = defaultPoint;
    }

    if (tendencyPoint.length === 0) {
        tendencyPoint = [
            Array.from({ length: readPlaceList[0].partner.length }, () => defaultPoint),
            Array.from({ length: readPlaceList[0].concept.length }, () => defaultPoint),
            Array.from({ length: readPlaceList[0].play.length }, () => defaultPoint),
            Array.from({ length: readPlaceList[0].tour.length }, () => defaultPoint),
            Array.from({ length: readPlaceList[0].season.length }, () => defaultPoint),
        ];
    }

    //readOnePlace로 처리할 수가 없음. 지역이 여러개면, 각 타임테이블 객체가 어디 지역인지 모름
    for (let a = 0; a < region.length; a++) {
        await readAllPlace(region[a])
            .then((res) => {
                readPlaceList = [...readPlaceList, ...res];
            })
            .catch((err) => {
                console.log(err);
            });

        for (let i = 0; i < timetable.length; i++) {
            for (let j = 0; j < timetable[i].length; j++) {
                // category == 0이면, 관광지 데이터셋임!
                if (timetable[i][j].category == 0) {
                    readPlaceList2.push(_.cloneDeep(timetable[i][j]));
                }
            }
        }

        // readPlaceList에서 필터링 -> 탐테에는 없는 최신 관광지 성향 정보들을 유지하기 위함
        readPlaceList = readPlaceList.filter((item1) =>
            readPlaceList2.some((item2) => item2.lat === item1.lat && item2.lng === item1.lng)
        );

        if (readPlaceList.length === 0) {
            console.log('readPlaceList.length === 0');
            return;
        }

        //점수 업데이트
        for (let i = 0; i < readPlaceList.length; i++) {
            let place = readPlaceList[i];

            let placeTendencyList = [place.partner, place.concept, place.play, place.tour, place.season];

            for (let x = 0; x < placeTendencyList.length; x++) {
                for (let y = 0; y < placeTendencyList[x].length; y++) {
                    //일반 별점 - 각 성향 점수 += (별점-4) * 선택 유무
                    placeTendencyList[x][y] += (point - 4) * tendency[x][y];

                    //세부 별점 - 각 성향 점수 += (별점-4)
                    placeTendencyList[x][y] += (tendencyPoint[x][y] - 4) * tendency[x][y];

                    //한도치 설정 ( 0 ~ 100 )
                    if (placeTendencyList[x][y] < 0) {
                        placeTendencyList[x][y] = 0;
                    } else if (placeTendencyList[x][y] > 100) {
                        placeTendencyList[x][y] = 100;
                    }
                }
            }

            console.log(place.tour);

            // 업데이트된 값을 저장
            await database
                .collection(region[a])
                .doc(place.name)
                .update({
                    popular: place.popular + (point - 4), // 인기도도 별점따라 올려줌
                    partner: place.partner,
                    concept: place.concept,
                    play: place.play,
                    tour: place.tour,
                    season: place.season,
                });
        }
    }
}

module.exports = router;
