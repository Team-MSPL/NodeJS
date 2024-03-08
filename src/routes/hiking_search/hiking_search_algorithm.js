var { readAllHiking } = require('../firebase/firebase_read_hiking.js');
var { readAllPlace } = require('../firebase/firebase_read_place.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

var _ = require('lodash');

//Step 1. Data Loading
async function dataLoading(collectionName, version) {
    let hikingList = []; // reset the list

    await readAllHiking(collectionName)
        .then((res) => {
            hikingList = [...hikingList, ...res];
        })
        .catch((err) => {
            console.log(err);
        });

    return hikingList;
}

// 탐방 코스 점수 계산 프로세스
function hikingPoint(targethiking, selectList, selectDifficulty) {
    let sum = 0;
    //그냥 500, 300으로 함 우선
    const weight = [500, 300];
    //let listSum = 0;
    //let sumForDistance = 0;

    let targethikingList = [targethiking.type, targethiking.season];

    for (let x = 0; x < targethikingList.length; x++) {
        listSum = 0;
        const targethikingNow = targethikingList[x]; //x까지 찾아가는 연산시간 절약
        const selectListNow = selectList[x]; //x까지 찾아가는 연산시간 절약
        const weightNow = weight[x];

        selectListNow.map((item, idx) => {
            listSum += targethikingNow[idx] * weightNow * item;
            //sumForDistance += weightNow * item;
            sum += weightNow * item;
        });
        //sum += listSum / count[x]; //count로 나누는게, 테마가 나눠져있는게 아니라서 그냥 없앰
    }

    return sum;
}

//HikingSearch를 실행시키는 비동기 함수
async function hikingSearch(mountainName, selectList, selectDifficulty, version) {
    console.log('탐방 코스 알고리즘 시작!');
    console.log('난이도', selectDifficulty[0], selectDifficulty[1]);

    //데이터 로딩
    let hikingList = await dataLoading(mountainName, version);
    console.log('전체 탐방 코스 수', hikingList.length);

    //알고리즘 실행
    let hikingPointList = [];

    hikingList.map((item, idx) => {
        //selectDifficulty가 범위 안 일때만 계산 + 여행 반경에 따른 지역 필터링 작업
        //클라이언트 스토어 업데이트 전까지
        //distance2 = 0;

        if (item.difficulty >= selectDifficulty[0] && item.difficulty <= selectDifficulty[1]) {
            hikingPointList.push({
                name: item.name,
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
                point: hikingPoint(item, selectList, selectDifficulty),
            });
        }
        //아무것도 선택 안해도 결과를 보여줘야하니까
        else {
            hikingPointList.push({
                name: item.name,
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
                point: -100000000,
            });
        }
    });

    hikingPointList = hikingPointList.sort((a, b) => b.point - a.point);

    let result = [];

    //탐방 코스 성향
    let tendencyData = [
        ['계곡을 따라 걷는', '가볍게 걷기 좋은', '원점회귀'],
        ['봄', '여름', '가을', '겨울'],
    ];

    //상위 5개 탐방 코스의 정보를 객체 배열에 저장
    for (let i = 0; i < 5; i++) {
        if (hikingPointList[i].point < -100000) {
            continue;
        }

        const topPankHiking = hikingPointList[i];

        let topRankTendency = [];

        const tendencyList = [topPankHiking.type, topPankHiking.season];

        //탐방 코스의 성향 중 점수가 높은 것들은 배열에 저장
        for (let x = 0; x < tendencyList.length; x++) {
            for (let y = 0; y < tendencyList[x].length; y++) {
                if (tendencyList[x][y] >= 80) {
                    topRankTendency.push(tendencyData[x][y]);
                }
            }
        }

        result.push({
            name: topPankHiking.name,
            tendency: topRankTendency,
            course: topPankHiking.course,
            difficulty: topPankHiking.difficulty,
            distance: topPankHiking.distance,
            infoContent: topPankHiking.infoContent,
            phoneNum: topPankHiking.phoneNum,
            takenTime: topPankHiking.takenTime,
            webSite: topPankHiking.webSite,
            photo: topPankHiking.photo,

            type: topPankHiking.type,
            season: topPankHiking.season,
        });
        console.log(topPankHiking.point);
    }

    for (let i = 0; i < result.length; i++) {
        console.log(result[i].name);
    }

    console.log(`------------------------------------------`);

    // //부가적으로 2초 기다리기
    // const wakeUpTime = Date.now() + 2000;
    // while (Date.now() < wakeUpTime) {}

    parentPort.postMessage({ result: result });
    return result;
}

if (isMainThread) {
    console.log('Main Thread');
} else {
    hikingSearch(workerData.mountainName, workerData.selectList, workerData.selectDifficulty, workerData.version);
}

//module.exports.hikingSearch = hikingSearch;
