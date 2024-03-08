const { database } = require('./firebase_options.js');
const User = require('../../schemas/user.js');

async function readAllHiking(collectionName) {
    let allHiking = [];
    try {
        const hikingSnapshot = await database.collection(collectionName).where('name', '!=', '탐방 코스 목록').get();
        let data = [];
        hikingSnapshot.forEach((doc) => {
            const docData = doc.data();
            data.push(docData);
        });

        data.map(async (item, idx) => {
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
                review: item.review || [], //review 필드 없는 경우 예외 처리

                type: item.type,
                season: item.season,
            };

            //리뷰 작성자 userName도 포함해서 주기 - 비동기 처리 문제 때문에 map 못씀
            for (const item2 of item.review) {
                console.log(item2.reviewUserToken);
                User.findOne({ userToken: item2.reviewUserToken })
                    .then((profile) => {
                        let reviewerName;

                        if (!profile) {
                            console.log(profile);
                            console.log('사용자를 찾을 수 없습니다.');
                            reviewerName = '나그네';
                        } else {
                            reviewerName = profile.userName;
                        }
                        // reviewerName 할당
                        item2.reviewerName = reviewerName;
                    })
                    .catch((error) => {
                        console.error('User.findOne() 함수에 문제 발생 : ', error);
                        return;
                    });
            }

            allHiking.push(hikingData);
        });

        //setCommunityData(data);
    } catch (error) {
        console.log('탐방 코스 데이터셋을 읽어오는 중에 문제가 발생했습니다:', error);
    }
    return allHiking;
}

module.exports.readAllHiking = readAllHiking;
