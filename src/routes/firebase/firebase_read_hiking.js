const { database } = require('./firebase_options.js');

async function readAllHiking(collectionName) {
    let allHiking = [];
    try {
        const hikingSnapshot = await database.collection(collectionName).where('name', '!=', '탐방 코스 목록').get();
        let data = [];
        hikingSnapshot.forEach((doc) => {
            const docData = doc.data();
            data.push(docData);
        });

        data.map((item, idx) => {
            let hikingData = {
                name: item?.name,
                course: item.course,
                difficulty: item.difficulty,
                distance: item.distance,
                infoContent: item.infoContent,
                phoneNum: item.phoneNum,
                takenTime: item.takenTime,
                webSite: item.webSite,
                photo: item.photo,

                type: item.type,
                season: item.season,
            };
            allHiking.push(hikingData);
        });

        //setCommunityData(data);
    } catch (error) {
        console.log('탐방 코스 데이터셋을 읽어오는 중에 오류가 발생했습니다:', error);
    }
    return allHiking;
}

module.exports.readAllHiking = readAllHiking;
