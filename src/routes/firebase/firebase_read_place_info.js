const { database } = require('./firebase_options.js');

async function readOnePlaceInfo(region, name) {
    let placeInfoData = {};
    try {
        const documentPath = '관광지 정보/관광지 정보/' + region + '/' + name;

        // Firestore에서 데이터 읽기
        const onePlaceSnapshot = await database.doc(documentPath).get();
        let item = onePlaceSnapshot.data();

        placeInfoData = {
            name: name,
            infoContent: item.infoContent,
            expense: item.expense,
            infoTitle: item.infoTitle,
            information: item.information,

            operationTime: item.operationTime,
            photo: item.photo,
            review: item.review || [], //review 필드 없는 경우 예외 처리
        };
    } catch (error) {
        console.log('관광지 정보 데이터를 읽어오는 중에 오류가 발생했습니다:', error);
        return null;
    }
    return placeInfoData;
}

module.exports.readOnePlaceInfo = readOnePlaceInfo;
