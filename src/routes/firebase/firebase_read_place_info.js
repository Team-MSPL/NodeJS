const { database } = require('./firebase_options.js');

async function readOnePlaceInfo(region, name) {
    let placeInfoData = {};
    try {
        const onePlaceSnapshot = await database
            .collection('관광지 정보')
            .doc('관광지 정보')
            .collection(region)
            .doc(name)
            .get();
        let item = onePlaceSnapshot.data();

        console.log(onePlaceSnapshot);

        placeInfoData = {
            name: name,
            infoContent: item.infoContent,
            expense: item.expense,
            infoTitle: item.infoTitle,
            information: item.information,

            operationTime: item.operationTime,
            photo: item.photo,
            review: item.review,
        };
    } catch (error) {
        console.log('관광지 정보 데이터를 읽어오는 중에 오류가 발생했습니다:', error);
        return null;
    }
    return placeInfoData;
}

module.exports.readOnePlaceInfo = readOnePlaceInfo;
