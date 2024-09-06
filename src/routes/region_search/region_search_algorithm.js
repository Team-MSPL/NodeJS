const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

var _ = require('lodash');

var count = [0, 0, 0, 0, 0]; //selectList 선택 개수 저장 배열
var countNum = 0; // 한 줄당 count 총 갯수

// 지역 점수 계산 프로세스
function regionPoint(targetregion, selectList, distanceSensitivity, recentPosition) {
    let sum = 0;
    //각 성향 카테고리별 가중치, weight[5]는 popular, 인기관광지 점수
    //0:누구와, 1:테마, 2:무엇을, 3:어디 ,4:계절, 5: 인기도
    //regionPoint에는 누구와 점수가 없음 - 주의!
    const weight = [100, 500, 500, 500, 50, 1];
    let listSum = 0;
    let sumForDistance = 0;

    let targetregionList = [
        [0, 0, 0, 0, 0, 0, 0], //regionPoint에는 누구와 점수가 없음 - 주의!
        targetregion.concept,
        targetregion.play,
        targetregion.tour,
        targetregion.season,
    ];

    //count가 0이면 스킵되게 바꿔버림 + selectList[0].length만큼 반복대신, 고정값만큼 반복되게하여 속도 향상
    //TODO for문이 더 빠르다길래 if + for 조합으로 하였음. 차후 && + map 조합으로도 테스트해볼 것
    for (let x = 0; x < 5; x++) {
        listSum = 0;
        const targetregionNow = targetregionList[x]; //x까지 찾아가는 연산시간 절약
        const selectListNow = selectList[x]; //x까지 찾아가는 연산시간 절약
        const weightNow = weight[x];

        if (count[x] > 0) {
            selectListNow.map((item, idx) => {
                listSum += targetregionNow[idx] * weightNow * item;
                sumForDistance += weightNow * item;
            });
            //평균을 계산하는 코드, 원래는 뒤에서 따로 계산하였으나, if (count[0] > 0)를 넣었기에 내부에 추가함
            //각 테마별 평균을 계산하는 것임. count 이용(routeSearch 시작때 미리 계산해 두었음)
            //TODO 유지할지, 수정할지 고민
            sum += listSum / count[x];
            //sum += listSum;
            //Math.ceil도 제거 - JavaScript에서는 int와 double의 구분이 없기 때문에!!
        }
    }

    //sum += targetregion.popular * weight[5]; //인기도 지표 포함하기

    //sum = sum / countNum; //이거로 몇개를 선택했든 평균낼 수 있음!! - 가중치의 존재로, 이래봤자 평균이 들쭉날쭉함

    if (recentPosition.lat != 0 || recentPosition.lng != 0) {
        const latDiff = targetregion.lat - recentPosition.lat;
        const longDiff = targetregion.lng - recentPosition.lng;

        let distance =
            Math.sqrt(latDiff ** 2 + longDiff ** 2) * ((10 - distanceSensitivity) * 0.5) * (sumForDistance + 1);
        sum -= distance; // 거리가 커질수록 안좋은 것임. 총점수에 - 연산으로 계산해줘야함.
        //sum += 1 / distance;
    }
    return sum;
}

// 두 좌표 사이 거리 구하기 함수
function distance(departure, arrival) {
    const dLat = (departure.lat - arrival.lat) * (Math.PI / 180);
    const dLon = (departure.lng - arrival.lng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(departure.lat * (Math.PI / 180)) *
            Math.cos(arrival.lat * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = 6371 * c;
    // const distance = Math.ceil(6371 * c); // 두 지점 간의 거리 (단위: km)
    return distance;
}

//RegionSearch를 실행시키는 비동기 함수
function regionSearch(selectList, selectPopular, distanceSensitivity, recentPosition, version, regionList) {
    console.log('여행 지역 알고리즘 시작!');
    let recentPositionFlag = false;
    if (recentPosition.lat !== 0 || recentPosition.lng !== 0) {
        console.log('현재 위치 좌표', recentPosition);
        recentPositionFlag = true;
    }
    console.log('인기도', selectPopular[0], selectPopular[1]);
    console.log('거리민감도', distanceSensitivity);

    console.log('전체 지역 수', regionList.length);

    console.log(`상위 5개 지역. 성향 선택 개수`, countNum);

    //selectList 선순회 - placePoint에서 평균 구할 때 사용 - 내부에서 계산하면 시간 오래 걸리니까
    count = [0, 0, 0, 0, 0]; //초기화
    countNum = 0;
    for (let x = 1; x < 5; x++) {
        for (let y = 0; y < selectList[x].length; y++) {
            if (selectList[x][y] == 1) {
                count[x] += 1;
                countNum += 1;
            }
        }
        // if (count[x] > 0) {
        // 	countNum += 1;
        // }
    }

    //알고리즘 실행
    let regionPointList = [];

    regionList.map((item, idx) => {
        //selectPopular가 범위 안 일때만 계산 + 여행 반경에 따른 지역 필터링 작업
        let distance2 = distance(item, recentPosition);
        //클라이언트 스토어 업데이트 전까지
        //distance2 = 0;

        if (
            item.popular >= selectPopular[0] &&
            item.popular <= selectPopular[1] &&
            distance2 <= distanceSensitivity * 50
        ) {
            regionPointList.push({
                name: item.name,
                photo: item.photo,
                takenDay: item.takenDay,
                concept: item.concept,
                play: item.play,
                tour: item.tour,
                season: item.season,
                point: regionPoint(item, selectList, distanceSensitivity, recentPosition),
            });
        }
        //아무것도 선택 안해도 결과를 보여줘야하니까
        else {
            regionPointList.push({
                name: item.name,
                photo: item.photo,
                takenDay: item.takenDay,
                concept: item.concept,
                play: item.play,
                tour: item.tour,
                season: item.season,
                point: -100000000,
            });
        }
    });

    regionPointList = regionPointList.sort((a, b) => b.point - a.point);

    let result = [];

    //여행 지역 성향
    let tendencyData;
    if (version == 1) {
        tendencyData = [
            ['나홀로', '연인과', '친구와', '가족과', '효도', '자녀와'],
            ['힐링', '액티비티', '배움이 있는', '맛있는'],
            ['레저스포츠', '문화시설', '사진 명소', '이색체험', '역사 여행'],
            ['바다', '산', '드라이브코스', '산책', '쇼핑', '자연경관', '시티투어', '지역축제', '전통한옥'],
            ['봄꽃', '여름피서', '가을단풍', '겨울스포츠.설경', '온천'],
        ];
    } else {
        tendencyData = [
            ['나홀로', '연인과', '친구와', '가족과', '효도', '자녀와'],
            ['힐링', '액티비티', '배움이 있는', '맛있는', '교통이 편한', '알뜰한'],
            ['레저 스포츠', '문화시설', '사진 명소', '이색체험', '역사 여행'],
            ['바다', '산', '드라이브코스', '산책', '쇼핑', '자연경관', '시티투어', '전통한옥'],
            ['봄', '여름', '가을', '겨울'],
        ];
    }

    //상위 5개 지역의 정보를 객체 배열에 저장
    for (let i = 0; i < 5; i++) {
        if (regionPointList[i].point < -100000) {
            continue;
        }

        const topPankRegion = regionPointList[i];

        let topRankTendency = [];

        const tendencyList = [
            [0, 0],
            topPankRegion.concept,
            topPankRegion.play,
            topPankRegion.tour,
            topPankRegion.season,
        ];

        //지역의 성향 중 점수가 높은 것들은 배열에 저장
        for (let x = 0; x < tendencyList.length; x++) {
            for (let y = 0; y < tendencyList[x].length; y++) {
                if (tendencyList[x][y] > 90) {
                    topRankTendency.push(tendencyData[x][y]);
                }
            }
        }

        if (topRankTendency.length < 5) {
            for (let x = 0; x < tendencyList.length; x++) {
                for (let y = 0; y < tendencyList[x].length; y++) {
                    if (tendencyList[x][y] > 70 && tendencyList[x][y] <= 89 && topRankTendency.length < 5) {
                        topRankTendency.push(tendencyData[x][y]);
                    }
                }
            }
        }

        if (topRankTendency.length < 5) {
            for (let x = 0; x < tendencyList.length; x++) {
                for (let y = 0; y < tendencyList[x].length; y++) {
                    if (tendencyList[x][y] > 50 && tendencyList[x][y] <= 69 && topRankTendency.length < 5) {
                        topRankTendency.push(tendencyData[x][y]);
                    }
                }
            }
        }

        if (topRankTendency.length < 5) {
            for (let x = 0; x < tendencyList.length; x++) {
                for (let y = 0; y < tendencyList[x].length; y++) {
                    if (tendencyList[x][y] > 30 && tendencyList[x][y] <= 49 && topRankTendency.length < 5) {
                        topRankTendency.push(tendencyData[x][y]);
                    }
                }
            }
        }

        //지역의 인기 관광지 저장
        let cityList = [];
        if (topPankRegion.name.length === 2) {
            if (topPankRegion.name === '제주') {
                cityList = [topPankRegion.name + ' 제주시', topPankRegion.name + ' 서귀포시'];
            } else if (topPankRegion.name === '서울') {
                cityList = [
                    topPankRegion.name + ' 도심권',
                    topPankRegion.name + ' 동남권',
                    topPankRegion.name + ' 동북권',
                    topPankRegion.name + ' 서남권',
                    topPankRegion.name + ' 서북권',
                ];
            } else {
                cityList = [topPankRegion.name + ' 전체'];
            }
        } else if (topPankRegion.name === '제주도') {
            cityList = [topPankRegion.name + ' 제주시', topPankRegion.name + ' 서귀포시'];
        } else {
            cityList = [topPankRegion.name];
        }

        result.push({
            name: topPankRegion.name,
            takenDay: topPankRegion.takenDay,
            photo: topPankRegion.photo,
            tendency: _.cloneDeep(topRankTendency),
            cityList: cityList,
            //topPopularPlaceList: topPopularPlaceList,
        });
    }

    const wakeUpTime = Date.now() + 3000;
    while (Date.now() < wakeUpTime) {}

    //parentPort.postMessage({ result: result });
    return result;
}

if (isMainThread) {
    console.log('Main Thread');
} else {
    regionSearch(
        workerData.selectList,
        workerData.selectPopular,
        workerData.distanceSensitivity,
        workerData.recentPosition,
        workerData.version
    );
}

module.exports.regionSearch = regionSearch;
