const { database } = require('./firebase_options.js');

async function readAllRegion(collectionName) {
    let allregion = [];
    try {
        //"관광지 목록" 문서는 제거
        const regionSnapshot = await database.collection(collectionName).where('name', '!=', '여행 지역 목록').get();
        let data = [];
        regionSnapshot.forEach((doc) => {
            const docData = doc.data();
            data.push(docData);
        });

        data.map((item, idx) => {
            let name = item?.name;
            let popular = item.popular;
            let takenDay = item.takenDay;
            let latitude = item.latitude;
            let longitude = item.longitude;

            let concept = item.concept;
            let play = item.play;
            let tour = item.tour;
            let season = item.season;
            let photo = item.photo;
            let regionData = {
                name: name,
                lat: latitude,
                lng: longitude,
                popular: popular,
                takenDay: takenDay,
                concept: concept,
                play: play,
                tour: tour,
                season: season,
                photo: photo,
            };
            allregion.push(regionData);
        });

        //setCommunityData(data);
    } catch (error) {
        console.log('관광지 데이터셋을 읽어오는 중에 오류가 발생했습니다:', error);
    }
    //한번에 map으로 불러오고, 관광지목록 <- 이것만 예외처리 해주면 될듯??, 이후에 매핑
    //혹은 데이터셋에 하나하나 관광지 이름 값도 넣어주기? - 코드로, 불러오기한 후에 다시 입력하기 하는 식으로

    // let regionList = await readregionList(city).then(data => {
    // 	return data;
    // });

    // for (let i = 0; i < regionList.length; i++) {
    // 	await readOneregion(city, regionList[i]).then(res => {
    // 		allregion[i] = res;
    // 	});
    // }
    return allregion;
}

async function readRegionList() {
    let regionList = null;
    const regionListSnapshot = await database.collection('전국 여행 지역').doc('여행 지역 목록').get();

    regionList = regionListSnapshot.data().관광지;

    return regionList;
}

async function readOneRegion(name) {
    let regionData = {};
    try {
        const oneregionSnapshot = await database.collection('전국 여행 지역').doc(name).get();
        let item = oneregionSnapshot.data();

        let name = item.name;
        let popular = item.popular;
        let takenDay = item.takenDay;
        let latitude = item.latitude;
        let longitude = item.longitude;

        let concept = item.concept;
        let play = item.play;
        let tour = item.tour;
        let season = item.season;
        let photo = item.photo;
        regionData = {
            name: name,
            lat: latitude,
            lng: longitude,
            takenDay: takenDay,
            popular: popular,
            concept: concept,
            play: play,
            tour: tour,
            season: season,
            photo: photo,
        };
    } catch (error) {
        console.log('관광 지역 데이터를 읽어오는 중에 오류가 발생했습니다:', error);
    }
    return regionData;
}

//export { readAllRegion, readRegionList, readOneRegion };
module.exports.readAllRegion = readAllRegion;
module.exports.readRegionList = readRegionList;
module.exports.readOneRegion = readOneRegion;
