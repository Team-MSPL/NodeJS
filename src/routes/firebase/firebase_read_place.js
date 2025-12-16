//import admin from 'firebase-admin';

//import serviceAccount from './danim-3439e-36fb00b7f31c.json?type=json';

//const admin = require('firebase-admin');
//const express = require('express');
//const router = express.Router();
const { database } = require('./firebase_options.js');
//const { initializeApp, cert } = require('firebase-admin/app');
//const { getFirestore } = require('firebase-admin/firestore');
//const serviceAccount = require('./danim-3439e-36fb00b7f31c.json');

//initializeApp({
//   credential: cert(serviceAccount),
//credential: applicationDefault()
//});
//const db = getFirestore();

async function readAllPlace(region, bandwidth, regionIndex) {
    let allPlace = [];
    try {
        //"관광지 목록" 문서는 제거
        const placeSnapshot = await database.collection(region).where('name', '!=', '관광지 목록').get();
        let data = [];
        placeSnapshot.forEach((doc) => {
            const docData = doc.data();
            data.push(docData);
        });

        data.map((item, idx) => {
            let name = item?.name;
            let latitude = item.latitude;
            let longitude = item.longitude;
            let popular = item.popular;
            let takenTime = item.takenTime;

            let partner = item.partner;
            let concept = item.concept;
            let play = item.play;
            let tour = item.tour;
            let season = item.season;
            placeData = {
                name: name,
                lat: latitude,
                lng: longitude,
                takenTime: takenTime,
                popular: popular,
                partner: partner,
                concept: concept,
                play: play,
                tour: tour,
                season: season,
                category: 0,
                photo: item.photo,
                regionIndex: regionIndex,
            };

            //여유로운 여행이면 takenTime 30분 추가
            if (bandwidth) {
                placeData.takenTime += 30;
            }
            allPlace.push(placeData);
        });

        //setCommunityData(data);
    } catch (error) {
        console.log('관광지 데이터셋을 읽어오는 중에 오류가 발생했습니다:', error);
    }
    //한번에 map으로 불러오고, 관광지목록 <- 이것만 예외처리 해주면 될듯??, 이후에 매핑
    //혹은 데이터셋에 하나하나 관광지 이름 값도 넣어주기? - 코드로, 불러오기한 후에 다시 입력하기 하는 식으로

    // let placeList = await readPlaceList(city).then(data => {
    // 	return data;
    // });

    // for (let i = 0; i < placeList.length; i++) {
    // 	await readOnePlace(city, placeList[i]).then(res => {
    // 		allPlace[i] = res;
    // 	});
    // }
    return allPlace;
}

async function readPlaceList(region) {
    let placeList = null;
    const placeListSnapshot = await database.collection(region).doc('관광지목록').get();

    placeList = placeListSnapshot.data().관광지;

    return placeList;
}

async function readOnePlace(region, name) {
    let placeData = {};
    try {
        const documentPath = region + '/' + name;

        // Firestore에서 데이터 읽기
        const onePlaceSnapshot = await database.doc(documentPath).get();
        let item = onePlaceSnapshot.data();

        placeData = {
            name: item.name,
            lat: item.latitude,
            lng: item.longitude,
            takenTime: item.takenTime,
            popular: item.popular,
            partner: item.partner,
            concept: item.concept,
            play: item.play,
            tour: item.tour,
            season: item.season,
            category: 0, // 이태운 추가 - 타임테이블을 위함
            photo: item.photo, // 이태운 추가 - 타임테이블 위 관광지 사진을 위함
        };
    } catch (error) {
        console.log('관광지 데이터를 읽어오는 중에 오류가 발생했습니다:', error);
    }
    return placeData;
}

//export { readAllPlace, readOnePlace, readPlaceList };
module.exports.readAllPlace = readAllPlace;
module.exports.readOnePlace = readOnePlace;
module.exports.readPlaceList = readPlaceList;
