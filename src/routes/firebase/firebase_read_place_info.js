const { database } = require('./firebase_options.js');
const User = require('../../schemas/user.js');

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
        if (placeInfoData.review.length === 0) {
            return placeInfoData;
        }

        //리뷰 작성자 userName, userProfileImage도 포함해서 주기 - 비동기 처리 문제 때문에 map 못씀
        for (const item of placeInfoData.review) {
            try {
                const profile = await User.findOne({ userToken: item.reviewUserToken });

                let reviewerName;
                let reviewerProfileImage;

                if (!profile) {
                    console.log(profile);
                    console.log('사용자를 찾을 수 없습니다.');
                    reviewerName = '나그네';
                    reviewerProfileImage = 'https://danim.me/square_logo.png';
                } else {
                    reviewerName = profile.userName;
                    reviewerProfileImage = profile.userProfileImage;
                }

                // 할당
                item.reviewerName = reviewerName;
                item.reviewerProfileImage = reviewerProfileImage;
            } catch (error) {
                console.error('User.findOne() 함수에 문제 발생 : ', error);
                res.status(403).json({ message: '잘못된 입력입니다.' });
            }
        }

        return placeInfoData;
    } catch (error) {
        console.log('관광지 정보 데이터를 읽어오는 중에 오류가 발생했습니다:', error);
        return null;
    }
}

module.exports.readOnePlaceInfo = readOnePlaceInfo;
