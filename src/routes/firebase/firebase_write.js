const { database } = require('./firebase_options.js');

async function writeReviewOnPlace(region, name, review) {
    try {
        const documentPath = '관광지 정보/관광지 정보/' + region + '/' + name;

        // Firestore에서 데이터 읽기
        const onePlaceSnapshot = await database.doc(documentPath).get();
        let reviewList = [];

        //데이터가 있을 경우
        if (
            onePlaceSnapshot.data().review !== null ||
            onePlaceSnapshot.data().review !== undefined ||
            onePlaceSnapshot.data().review.length !== 0
        ) {
            reviewList = onePlaceSnapshot.data().review;
        }

        reviewList.push(review);

        let result;

        await database
            .doc(documentPath)
            .update({
                review: reviewList,
            })
            .then(() => {
                console.log('review 필드 업데이트 성공');
                result = { status: 'success' };
            })
            .catch((error) => {
                console.error('review 필드를 업데이트하는 중 에러 발생:', error);
                result = { status: 'update error' };
            });

        console.log('result 값:', result);

        return result;
    } catch (error) {
        console.log('관광지 정보 데이터를 읽어오는 중에 오류가 발생했습니다:', error);
        return { status: 'read fail' };
    }
}

async function deleteReviewOnPlace(region, name, review) {
    try {
        const documentPath = '관광지 정보/관광지 정보/' + region + '/' + name;

        // Firestore에서 데이터 읽기
        const onePlaceSnapshot = await database.doc(documentPath).get();

        const reviewList = onePlaceSnapshot.data().review;

        //데이터가 없을 경우
        if (reviewList === null || reviewList === undefined || reviewList.length === 0) {
            return { status: 'no data' };
        }

        const updatedReviewList = reviewList.filter((reviewData) => {
            // 리뷰 필드의 내용, 사진 리스트, 사용자 토큰이 하나라도 일치하지 않는 경우만 남기기 ( 모두 일치하면 제거 )
            return (
                reviewData.reviewContent !== review.reviewContent ||
                !arraysEqual(reviewData.reviewPhotoList, review.reviewPhotoList) ||
                reviewData.reviewUserToken !== review.reviewUserToken
            );
        });

        // 여기서 updatedReviewList를 사용하거나 필요한 작업을 수행
        console.log(
            '삭제된 리뷰:',
            reviewList.filter((reviewData) => !updatedReviewList.includes(reviewData))
        );

        if (reviewList.filter((reviewData) => !updatedReviewList.includes(reviewData)).length === 0) {
            return { status: 'no data' };
        }

        // 다시 업데이트
        const docRef = database.doc(documentPath);
        await docRef.update({
            review: updatedReviewList,
        });

        console.log('리뷰 삭제 성공');
        return { status: 'success' };
    } catch (error) {
        console.log('관광지 정보 데이터를 읽어오는 중에 오류가 발생했습니다:', error);
        return { status: 'read fail' };
    }
}

// 배열 비교 함수
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }

    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }

    return true;
}

module.exports.writeReviewOnPlace = writeReviewOnPlace;
module.exports.deleteReviewOnPlace = deleteReviewOnPlace;
