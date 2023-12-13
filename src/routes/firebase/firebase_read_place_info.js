const { database } = require('./firebase_options.js');

async function readOnePlaceInfo(region, name) {
    let placeInfoData = {};
    try {
        // const onePlaceSnapshot = await database
        //     // .collection('관광지 정보')
        //     // .doc('관광지 정보')
        //     .collection(region)
        //     .get();
        //let item = onePlaceSnapshot.data();

        const documentPath = '관광지 정보/관광지 정보/대전/계룡산국립공원 수통골지구';

        // Firestore에서 데이터 읽기
        const onePlaceSnapshot = await database.doc(documentPath).get();
        let data = [];
        // onePlaceSnapshot.forEach((doc) => {
        //     const docData = doc.data();
        //     console.log(docData);
        //     data.push(docData);
        // });
        console.log(onePlaceSnapshot);
        console.log(onePlaceSnapshot.data());
        console.log(region);
        console.log(name);

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
