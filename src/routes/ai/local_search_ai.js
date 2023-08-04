//import { readAllPlace } from './firebase_read_place.js';

var { readAllPlace } = require('./firebase_read_place.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
var enoughPlaceInThread = require('./local_search_ai_thread.js');
var _ = require('lodash');

var enoughPlace = true; //관광지가 부족하여 중단할 경우 false가 됨. -> 다이어로그 표시!

var count = [0, 0, 0, 0, 0]; //selectList 선택 개수 저장 배열

var placeList = []; //장소 리스트, 전역 변수, 원본
var placeListCopy = []; //장소 리스트, 전역 변수, n일차 코스를 위함, path에 들어간 Place들은 제거하는 리스트
var transitInAI = 0;
var distanceSensitivityInAI = 5; //거리민감도 전역변수

// 숙소, 필수여행지 총 합계 계산(숙소는 -2) + 총날짜도 고려!! - 반복 횟수 줄이기에 사용
var selectedNum = 0;

var pathList = [];

//Step 1. Data Loading
async function dataLoading(cityList) {
    placeList = []; // reset the list
    placeListCopy = []; // reset the list

    for (let i = 0; i < cityList.length; i++) {
        await readAllPlace(cityList[i])
            .then((res) => {
                placeList = [...placeList, ...res];
                placeListCopy = [...placeListCopy, ...res];
            })
            .catch((err) => {
                console.log(err);
            });
    }
}

function ai_run(accomodationList, selectList, essentialPlaceList, time, nDay) {
    const threads = new Set();
    return new Promise((resolve, reject) => {
        let primeNum = Math.floor(Math.random() * 1000) + 1;
        //console.time('prime' + primeNum);

        if (isMainThread) {
            // 우리가 워커가 일을 할수있게 분배하고 직접 짜야 한다. 여간 복잡한게 아니다..
            for (let i = 0; i < 5; i++) {
                threads.add(
                    //이거 경로는 root 폴더를 기준으로 설정해야함. worker가 root폴더에 있기 때문에!!
                    new Worker('./src/routes/ai/local_search_ai_thread.js', {
                        workerData: {
                            accomodationList: accomodationList,
                            selectList: selectList,
                            essentialPlaceList: essentialPlaceList,
                            time: time,
                            nDay: nDay,
                            count: count,
                            placeList: placeList,
                            placeListCopy: placeListCopy,
                            transitInAI: transitInAI,
                            distanceSensitivityInAI: distanceSensitivityInAI,
                            selectedNum: selectedNum,
                            threadNum: threads.size,
                        },
                    })
                );
            }
            // 워커들 이벤트 등록
            for (let worker of threads) {
                worker.on('error', (err) => {
                    throw err;
                });
                worker.on('message', (message) => {
                    //console.log('Message from worker:', message);
                    pathList.push(message);
                });
                //worker.on('exit', resolve);
                worker.on('exit', () => {
                    //pathList.push(worker.result);
                    //console.log(pathList);
                    threads.delete(worker);

                    if (threads.size === 0) {
                        //console.timeEnd('prime' + primeNum);
                        //primes = 0;
                        resolve('성공');
                    }
                });

                // 워커들이 일한 결과를 메시지 받아서 정리해주는 동작도 직접 구현
                worker.on('message', (msg) => {
                    //primes = primes.concat(msg);
                    //primes += msg;
                });
            }
        }
    });
}

//localSearchAI를 실행시키는 비동기 함수
async function localSearchAI({
    regionList,
    accomodationList,
    selectList,
    essentialPlaceList,
    timeLimitArray,
    nDay,
    transit,
    distanceSensitivity,
}) {
    console.log('여행 코스 AI 시작!');

    //시간 재기
    const startTime = performance.now();

    //데이터 로딩
    await dataLoading(regionList);
    console.log('전체 관광지 수', placeList.length);

    //AI를 위한 데이터 전처리 시작

    //자차, 대중교통 - 전역변수 저장
    transitInAI = transit;
    distanceSensitivityInAI = distanceSensitivity;

    // 숙소, 필수여행지 총 합계 계산 + 총날짜도 고려!! - , 반복 횟수 줄이기에 사용
    // 총날짜 (nDay)를 3으로 나눈 몫만큼 빼주자 -> 3일이면 -1, 6일이면 -2 -> 날짜가 많으면 선택 많이해도 지장 줄어드니까
    let accomodationNum = 0;
    accomodationList.map((item, idx) => {
        if (item.name != '') {
            accomodationNum += 1;
        }
    });
    selectedNum = accomodationNum + essentialPlaceList.length - ~~(nDay / 3);

    //selectList 선순회 - placePoint에서 평균 구할 때 사용 - 내부에서 계산하면 시간 오래 걸리니까
    count = [0, 0, 0, 0, 0]; //초기화
    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < selectList[x].length; y++) {
            if (selectList[x][y] == 1) count[x] += 1;
        }
    }

    let timeLimit = 0;
    let time = [];

    //시간 지정 안했을 경우 하루당 8시간
    if (timeLimitArray == null) {
        timeLimit = 8 * 60;
        for (let d = 0; d < nDay; d++) {
            time.push(timeLimit);
        }
    }
    //시간 지정 했을 경우
    else {
        //당일치기여행이면, timeLimitArray[0]~timeLimitArray[1]만 생각하면 된다.
        if (nDay == 1) {
            timeLimit = timeLimitArray[1] - timeLimitArray[0];

            timeLimit > 6 ? (timeLimit = timeLimit - 5) : (timeLimit = timeLimit - 3);

            timeLimit = timeLimit * 60;
            time.push(timeLimit);
        }
        //timeLimit 계산해주기 - timeLimitArray[0] = 첫날 시작시간
        //timeLimitArray[1] = 마지막 날 끝나는 시간
        //3시간 이동시간으로 빼주기
        else {
            timeLimit = 20 - timeLimitArray[0];
            timeLimit = timeLimit * 60;
            time.push(timeLimit);

            for (let d = 0; d < nDay - 2; d++) {
                timeLimit = 8 * 60;
                time.push(timeLimit);
            }

            timeLimit = timeLimitArray[1] - 8;
            // timeLimit = timeLimit * 60;
            time.push(timeLimit * 60);
        }
    }
    //timeLimit 계산 종료

    //AI를 위한 데이터 전처리 종료

    //AI 실행
    // const readData = await routeSearch(accomodationList, selectList, essentialPlaceList, timeLimitArray, nDay, transit);

    //숙소에 성향값 넣어주기
    let a = {
        popular: 0,
        partner: [0, 0, 0, 0, 0, 0, 0],
        concept: [0, 0, 0, 0],
        play: [0, 0, 0, 0, 0, 0],
        tour: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        season: [0, 0, 0, 0],
    };
    const accomodationList2 = accomodationList.map((item, idx) => {
        return Object.assign({}, item, a);
    });
    await ai_run(accomodationList2, selectList, essentialPlaceList, time, nDay);
    const resultData = pathList;

    //시간 재기
    const endTime = performance.now();
    //console.log(resultData);

    for (let i = 0; i < resultData.length; i++) {
        console.log(`코스`, i + 1);
        for (let j = 0; j < resultData[i].length; j++) {
            console.log(`날짜 : ${j + 1}`);
            for (let k = 0; k < resultData[i][j].length; k++) {
                console.log(resultData[i][j][k].name);
            }
        }
        console.log(`------------------------------------------`);
    }

    //console.log(result);
    console.log(`AI 돌리는데 걸리는 시간`);

    const elapsedTime = endTime - startTime;

    console.log(`Elapsed time: ${elapsedTime / 1000} seconds`);
    console.log(`------------------------------------------`);

    //어떤 스레드에서 enoughPlaceInThread가 false면, enoughPlace도 false!!
    if (!enoughPlaceInThread) {
        enoughPlace = false;
    }

    return resultData;
}

//export { localSearchAI, enoughPlace };

module.exports.localSearchAI = localSearchAI;
module.exports.enoughPlace = enoughPlace;
// module.exports.count = count;
// module.exports.placeList = placeList;
// module.exports.placeListCopy = placeListCopy;
// module.exports.transitInAI = transitInAI;
// module.exports.distanceSensitivityInAI = distanceSensitivityInAI;
// module.exports.selectedNum = selectedNum;
