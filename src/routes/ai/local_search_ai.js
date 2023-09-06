//import { readAllPlace } from './firebase_read_place.js';

var { readAllPlace } = require('../firebase/firebase_read_place.js');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
var _ = require('lodash');

var enoughPlace = true; //관광지가 부족하여 중단할 경우 false가 됨. -> 다이어로그 표시!

var count = [0, 0, 0, 0, 0]; //selectList 선택 개수 저장 배열

var placeList = []; //장소 리스트, 전역 변수, 원본
var placeListCopy = []; //장소 리스트, 전역 변수, n일차 코스를 위함, path에 들어간 Place들은 제거하는 리스트
var transitInAI = 0;
var distanceSensitivityInAI = 5; //거리민감도 전역변수

// 숙소, 필수여행지 총 합계 계산(숙소는 -2) + 총날짜도 고려!! - 반복 횟수 줄이기에 사용
var selectedNum = 0;

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

var enoughPlaceInThread = true; //관광지가 부족하여 중단할 경우 false가 됨. -> 다이어로그 표시!

var count = [0, 0, 0, 0, 0]; //selectList 선택 개수 저장 배열

let countNum = 0;

const NUM_OF_PATH = 7;

//각 성향 카테고리별 가중치, weight[5]는 popular, 인기관광지 점수
//0:누구와, 1:테마, 2:무엇을, 3:어디 ,4:계절, 5: 인기도
//threadNum만큼 곱할거라, 원래 값에서 1/5함
const weight = [40, 200, 200, 200, 20, 0.005];

var placeList = []; //장소 리스트, 전역 변수, 원본
var placeListCopy = []; //장소 리스트, 전역 변수, n일차 코스를 위함, path에 들어간 Place들은 제거하는 리스트
var transitInAI = 0;
var distanceSensitivityInAI = 5; //거리민감도 전역변수

// 숙소, 필수여행지 총 합계 계산(숙소는 -2) + 총날짜도 고려!! - 반복 횟수 줄이기에 사용
var selectedNum = 0;

var threadNum = 0; //멀티스레딩에 사용. 지금 돌아가는 스레드가 몇 번째 스레드인지

var dummy = {
    name: '',
    lat: 0.0,
    lng: 0.0,
    takenTime: 0,
    popular: 0,
    partner: [0, 0, 0, 0, 0, 0, 0],
    concept: [0, 0, 0, 0],
    play: [0, 0, 0, 0, 0, 0],
    tour: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    season: [0, 0, 0, 0],
    category: 8,
    photo: '',
};

var corDis = [];

// 관광지 점수 계산 프로세스 - 가장 많이 반복되는 함수
function placePoint(selectList, beforePlace, targetPlace, timeLimit = 1000, findFirstPlacefromAcm = false) {
    //반려견과, 실내여행지는 예외처리 - selectList에 있고 + 점수가 30점 이하면, sum = 0을 리턴
    if (
        (selectList[0][6] === 1 && targetPlace.partner[6] < 30) ||
        (selectList[3][5] === 1 && targetPlace.tour[5] < 30) ||
        timeLimit < targetPlace.takenTime
    ) {
        return -10000000;
    }

    let sum = 0;
    let listSum = 0;
    let sumForDistance = 0;

    let targetPlaceList = [
        targetPlace.partner,
        targetPlace.concept,
        targetPlace.play,
        targetPlace.tour,
        targetPlace.season,
    ];

    //count가 0이면 스킵되게 바꿔버림 + selectList[0].length만큼 반복대신, 고정값만큼 반복되게하여 속도 향상
    //TODO for문이 더 빠르다길래 if + for 조합으로 하였음. 차후 && + map 조합으로도 테스트해볼 것
    for (let x = 0; x < 5; x++) {
        listSum = 0;
        const targetPlaceNow = targetPlaceList[x]; //x까지 찾아가는 연산시간 절약
        const selectListNow = selectList[x]; //x까지 찾아가는 연산시간 절약
        const weightNow = weight[x];

        if (count[x] > 0) {
            selectListNow.map((item, idx) => {
                listSum += targetPlaceNow[idx] * weightNow * item;
                sumForDistance += weightNow * item;
            });
            //평균을 계산하는 코드, 원래는 뒤에서 따로 계산하였으나, if (count[0] > 0)를 넣었기에 내부에 추가함
            //각 테마별 평균을 계산하는 것임. count 이용(routeSearch 시작때 미리 계산해 두었음)
            //TODO 유지할지, 수정할지 고민
            sum += listSum / count[x];
            //Math.ceil도 제거 - JavaScript에서는 int와 double의 구분이 없기 때문에!!
        }
    }

    //성향 종류별로 선택한 갯수만큼 나눠줘서, 표준화시키자
    sum = sum / countNum;

    sum += targetPlace.popular * weight[5]; //인기도 지표 포함하기

    if (beforePlace.name != '') {
        //더미는 스킵
        if (targetPlace.lat === 0.0 || beforePlace.lat === 0.0) {
            return sum;
        }

        const latDiff = targetPlace.lat - beforePlace.lat;
        const longDiff = targetPlace.lng - beforePlace.lng;

        let distance = 0;

        //대중교통, 자차에 따른 거리민감도 계산 - 삼항 연산자로 간단하게 바꿈
        //latDiff * latDiff와 같은 부분도 거듭 제곱 연산자 **로 바꿈
        if (findFirstPlacefromAcm) {
            distance =
                transitInAI === 1
                    ? Math.sqrt(latDiff ** 2 + longDiff ** 2) * ((10 - distanceSensitivityInAI) * 15) * sumForDistance
                    : Math.sqrt(latDiff ** 2 + longDiff ** 2) * ((10 - distanceSensitivityInAI) * 20) * sumForDistance;
        } else {
            distance =
                transitInAI === 1
                    ? Math.sqrt(latDiff ** 2 + longDiff ** 2) * ((10 - distanceSensitivityInAI) * 3) * sumForDistance
                    : Math.sqrt(latDiff ** 2 + longDiff ** 2) * ((10 - distanceSensitivityInAI) * 4) * sumForDistance;
        }
        sum -= distance; // 거리가 커질수록 안좋은 것임. 총점수에 - 연산으로 계산해줘야함. 위와 마찬가지로 Math.round()연산 제거
    }

    return sum;
}

//Step 2. Initialization
async function initializeGreedy(selectList, firstPlace, todayEssentialPlaceList, timeLimit) {
    let path = [];
    path.push(firstPlace);

    //placeListCopy에서는 제거
    placeListCopy = placeListCopy.filter((item) => item.name != firstPlace.name);

    //todayEssentialPlaceList가 있을 경우 - 미리 넣어준다!
    todayEssentialPlaceList.length > 0 &&
        todayEssentialPlaceList.map((item, idx) => {
            path.push(item);
            //어차피, todayEssentialPlaceList만드는 과정에서 필터링해줌
            //placeListCopy = placeListCopy.filter((item2) => item2.name !== item.name);
        });

    let numPlace = placeListCopy.length; //향후 반복문 내부에서 값이 바뀔 것이기에, 미리 저장해두고 사용한다.

    let totalTime = 0; // 총 여행 시간 (오늘치)

    let nextIndex = -1;

    //거리 민감도에 따라 이동시간 어림을 다르게 함
    let moveTime = 30;

    let lessTime = timeLimit;

    if (distanceSensitivityInAI < 6) {
        moveTime = 60;
    }

    //만약, 숙소를 골라두었을 경우, 마지막 장소로 가는 소요시간까지 생각하기 - 과거 firstPlace가 없을 수도 있었던 시절의 유산
    // if (firstPlace.name != '' && timeLimit > 2) {
    // 	timeLimit -= 1;
    // }

    // Iteratively connect nearest places - 점수 계산 프로세스(placePoint)를 통해
    for (let i = path.length; i < placeListCopy.length; i++) {
        if (placeListCopy.length < 1) {
            //이러면, 관광지 부족하다는 뜻!, 중단하고 프리셋에서 안내메세지 띄우자

            console.log('남은 관광지 수1111');
            console.log(placeListCopy.length);
            enoughPlace = false;
            break;
        }

        let sum = Array(placeListCopy.length).fill(-100000000); // 각 관광지의 점수 합

        //각 관광지별  점수 계산하기
        placeListCopy.map((item, idx) => {
            //path[i - 1]이 맞음. 외부 반복문 확인할것.
            //단순히 indexOf로 찾으면 중복값 처리가 안됨. -> 맨 앞의 값으로 하기 때문에 안좋은 결과가 나옴
            sum[idx] = { sum: placePoint(selectList, path[i - 1], placeListCopy[idx], timeLimit), index: idx };
        });

        //sort해서 다음 목적지 고르기, sort해서 그 인덱스 번호를 알아와야함. 그래야 Place리스트에서 쓸 수 있음.
        let sumCopy = _.cloneDeep(sum);
        sumCopy = [...sum].sort((a, b) => b.sum - a.sum); // 내림차순!! 밑의 q가 0번 인덱스부터 시도하니깐

        let noPlaceFlag = false;

        for (let q = 0; q < sumCopy.length; q++) {
            //nextIndex = sum.indexOf(sumCopy[q]);
            nextIndex = sumCopy[q].index; // 다음 목적지의 Index
            // path에 placeLisftCopy[nextIndex]가 없을 경우 다음 목적지 확정 (sort결과 최고의 목적지)
            // ++) 여기서 시간도 고려해줌! 너무 많이 넘치는 관광지는 안됨
            if (path.indexOf(placeListCopy[nextIndex]) === -1 && placeListCopy[nextIndex].takenTime < lessTime + 31) {
                break;
            }
            if (q === numPlace - 1) {
                noPlaceFlag = true;
            }
        }

        if (noPlaceFlag) {
            break;
        }

        // path에 관광지 추가, placeListCopy에서는 제거
        path.push(_.cloneDeep(placeListCopy[nextIndex]));
        placeListCopy.splice(nextIndex, 1);

        //그리디 종료 시점 계산 - 오늘치 총 소요시간을 계산함
        totalTime += path[i].takenTime; // 관광지에서 소요시간

        lessTime = timeLimit - (path.length - 1) * moveTime - totalTime;

        //코스의 길이가 길수록 이동시간도 길어짐
        //길이에 비례하여 timeLimit를 줄임
        if (lessTime < 0) {
            //예정된 여행 시간만큼의 일정이 채워졌다면 반복 종료
            break;
        }
    }

    return path;
}

//Step 3-2. 코스 개선 시도를 위한 방법 - 2가지 (관광지 교체, 순서 변경)
function twoOpts(path, selectList, todayAccomodationList, todayEssentialPlaceList, timeLimit) {
    //숙소, 필수여행지 선택 횟수에 따라 2-opts 시도 횟수 조절
    let iterations = 500 - selectedNum * 60; //2-opts 시도 횟수

    let bestPath = _.cloneDeep(path);

    let bestPoint = 0;

    let selectWay = 2;

    let pathLength = placeListCopy.length;

    //판단 기준은 placePoint의 합으로 한다.
    bestPoint += placePoint(selectList, dummy, bestPath[0], timeLimit);
    for (let i = 1; i < bestPath.length; i++) {
        bestPoint += placePoint(selectList, bestPath[i - 1], bestPath[i], timeLimit);
    }

    for (let i = 0; i < iterations + 1; i++) {
        //1. 관광지 하나를 새 관광지로 바꾼다. - 모든 관광지를 갈 경우 안함.
        if (selectWay === 1 && placeListCopy.length > 0) {
            let newPath = _.cloneDeep(bestPath);
            let idxa = Math.floor(Math.random() * (placeListCopy.length - 1));

            const isAccommodationEmpty = todayAccomodationList[1].name === '';
            const maxIdx = bestPath.length - (isAccommodationEmpty ? 1 : 2);
            let idxr = ~~(Math.random() * maxIdx) + 1;

            let addPlace = _.cloneDeep(placeListCopy[idxa]);
            let removePlace = _.cloneDeep(newPath[idxr]);

            //필수여행지(todayEssentialPlaceList)가 있는데, removePlace가 이 안에 있다면, continue
            if (
                todayEssentialPlaceList.some((item) => item.name === removePlace.name) //||
                //newPath.some((item) => item.name === addPlace.name)
            ) {
                continue; //같은 이름이 있으면, continue;
            }

            //newPath 개선 시도
            newPath[idxr] = _.cloneDeep(addPlace);

            //코스 개선 여부 확인
            let newPoint = 0;
            newPoint += placePoint(selectList, dummy, newPath[0], timeLimit);
            for (let n = 1; n < newPath.length; n++) {
                newPoint += placePoint(selectList, newPath[n - 1], newPath[n], timeLimit);
            }

            if (newPoint > bestPoint) {
                //placeListCopy도 업데이트
                placeListCopy[idxa] = _.cloneDeep(removePlace);

                bestPath = _.cloneDeep(newPath);
                bestPoint = newPoint;

                //다음 개선 방법 선택
                selectWay = 1;
            } else {
                selectWay = 2;
            }
        }

        //2. 이미 있는 코스에서 2개를 바꾼다.
        else {
            let idx1 = -1;
            let idx2 = -1;

            if (bestPath.length > 2) {
                const isAccommodationEmpty = todayAccomodationList[1].name === '';
                const maxIdx = bestPath.length - (isAccommodationEmpty ? 1 : 2);

                // Math.floor()보다 ~~이 더 빠르다고함. 이 Math연산이 시간을 은근 잡아먹음.
                //idx1 = Math.floor(Math.random() * maxIdx) + 1;
                //idx2 = Math.floor(Math.random() * maxIdx) + 1;
                idx1 = ~~(Math.random() * maxIdx) + 1;
                idx2 = ~~(Math.random() * maxIdx) + 1;

                //두 개의 인덱스는 같으면 안됨!
                //idx1, 2 순서 정렬 - idx1이 idx2보다 작아야함 (오름차순)
                if (idx1 >= idx2) {
                    if (idx1 === idx2) {
                        continue;
                    }
                    let idx3 = idx1;
                    idx1 = idx2;
                    idx2 = idx3;
                }
            } else {
                //twoOpts할 필요없이, 코스가 너무 짧음
                break;
            }

            let newPath = _.cloneDeep(bestPath);
            let temp = bestPath[idx1];
            let temp2 = bestPath[idx2];

            newPath[idx1] = _.cloneDeep(temp2);
            newPath[idx2] = _.cloneDeep(temp);

            //코스 개선 여부 확인
            let newPoint = 0;
            newPoint += placePoint(selectList, dummy, newPath[0], timeLimit);
            for (let n = 1; n < newPath.length; n++) {
                newPoint += placePoint(selectList, newPath[n - 1], newPath[n], timeLimit);
            }

            if (newPoint > bestPoint) {
                bestPath = _.cloneDeep(newPath);
                bestPoint = newPoint;

                //다음 개선 방법 선택
                selectWay = 2;
            } else {
                selectWay = 1;
            }
        }
    }

    return bestPath;
}

//Step 3-1. 코스 개선을 위한 Hill Climbing - Local Optima를 찾기 위한 과정
function hillClimbing(path, selectList, todayAccomodationList, todayEssentialPlaceList, timeLimit) {
    //숙소, 필수여행지 선택 횟수에 따라 HC 횟수 조절
    let StopRepeat = 5 - selectedNum; //개선 여부에 따른 HC 횟수 조절
    let StopRepeat2 = 2000 - selectedNum * 300; //너무 많이 반복되는 것 방지

    let kOptContinue = true;

    let kOptCheck = 0;
    let kOptCheck2 = 0;

    let bestPath = _.cloneDeep(path);

    let bestPoint = 0;

    //오늘차 기준으로 placeListCopy를 저장해두고, 이후 반복문이 끝날때마다 업데이트 해줌
    let placeListCopySaveInThisDay = _.cloneDeep(placeListCopy);

    //판단 기준은 시간 제외, placePoint의 합으로 한다.
    //제한 시간은 동일하니, 동선이 좋다면 관광지 수가 많아 점수가 높을 것
    bestPoint += placePoint(selectList, dummy, bestPath[0], timeLimit);
    for (let i = 1; i < bestPath.length; i++) {
        bestPoint += placePoint(selectList, bestPath[i - 1], bestPath[i], timeLimit);
    }
    //여기까지 살펴봄!!!!

    //멀티쓰레딩 없이 여러개의 경로 추출
    let bestPathList = [];
    let bestPathPointList = [];

    bestPathList.push(bestPath);
    bestPathPointList.push(bestPoint);

    for (let i = 0; i < NUM_OF_PATH - 1; i++) {
        let newPath = twoOpts(bestPath, selectList, todayAccomodationList, todayEssentialPlaceList, timeLimit);
        bestPathList.push(newPath);

        let newPoint = 0;
        newPoint += placePoint(selectList, dummy, newPath[0], timeLimit);
        for (let i = 1; i < newPath.length; i++) {
            newPoint += placePoint(selectList, newPath[i - 1], newPath[i], timeLimit);
        }
        bestPathPointList.push(newPoint);
    }
    //멀티쓰레딩 없이 여러개의 경로 추출

    while (kOptContinue) {
        let newPath = twoOpts(
            bestPathList[kOptCheck2 % 5], //이렇게 해야 다양한 경로를 개선 가능
            selectList,
            todayAccomodationList,
            todayEssentialPlaceList,
            timeLimit
        );

        let newPoint = 0;
        newPoint += placePoint(selectList, dummy, newPath[0], timeLimit);
        for (let i = 1; i < newPath.length; i++) {
            newPoint += placePoint(selectList, newPath[i - 1], newPath[i], timeLimit);
        }

        for (let i = 0; i < bestPathPointList.length; i++) {
            // 2-opts를 통해 개선이 일어났다면, 기존 path와 교체
            if (newPoint > bestPathPointList[i]) {
                bestPathList[i] = _.cloneDeep(newPath);
                bestPathPointList[i] = newPoint;
                kOptCheck = 0; //개선이 일어났으면 k_opt_check를 0으로 초기화하여 다시 카운트
                break;
            }
            if (i === bestPathPointList.length - 1) {
                kOptCheck += 1;
            }
        }

        //placeListCopy 중복처리 다시 - 모든 bestPath에 대하여
        placeListCopy = _.cloneDeep(placeListCopySaveInThisDay);

        for (let i = 0; i < bestPathList.length; i++) {
            const bestPathSet = new Set(bestPathList[i].map((item) => JSON.stringify(item.name)));
            placeListCopy = placeListCopy.filter((item) => !bestPathSet.has(JSON.stringify(item.name)));
        }

        kOptCheck2 += 1; //k_opt_check2는 그대로 카운트. 최대치(한도) 계산이기 때문에

        //개선이 StopRepeat만큼 일어나지 않으면 반복문 종료
        if (kOptCheck >= StopRepeat || kOptCheck2 >= StopRepeat2) {
            kOptContinue = false;
        }
    }

    //이후 후처리는 모든 bestPathList의 값들에 대하여 따로따로 해줘야 함
    for (let i = 0; i < bestPathList.length; i++) {
        //시간 계산해서 뒷부분 짤라야 함
        let totalTime = 0;

        bestPathList[i].map((item, idx) => {
            totalTime += bestPathList[i][idx].takenTime;
        });

        //거리 민감도에 따라 이동시간 어림을 다르게 함
        let moveTime = 30;

        if (distanceSensitivityInAI < 6) {
            moveTime = 60;
        }

        //코스의 길이가 길수록 이동시간도 길어짐
        //길이에 비례하여 timeLimit를 줄임
        if (totalTime > timeLimit - (bestPathList[i].length - 1) * moveTime) {
            let canPopPlaceList = []; //bestPath에서 빼낼 수 있는 관광지 리스트들 - 숙소, 필수 여행지 제외 장소들!

            // canPopPlaceList를 찾는 과정
            for (let t = 0; t < bestPathList[i].length; t++) {
                let checkAcm = false;
                let checkEssential = false;

                //숙소일경우
                if (
                    bestPathList[i][t].name === todayAccomodationList[0].name ||
                    bestPathList[i][t].name === todayAccomodationList[1].name
                ) {
                    checkAcm = true;
                }

                //필수 여행지가 있을 경우
                todayEssentialPlaceList.length > 0 &&
                    todayEssentialPlaceList.map((item, idx) => {
                        //bestPathList[i][t]가 todayEssentialPlaceList 내부에 있을 경우, 필수 여행지라는 뜻
                        if (bestPathList[i][t].name === item.name) {
                            checkEssential = true;
                        }
                    });

                //숙소 or 필수 여행지가 아니라면, bestPathList[i][t]를 canPopPlaceList에 넣음
                !checkAcm && !checkEssential && canPopPlaceList.push(_.cloneDeep(bestPathList[i][t]));
                // if (!checkAcm && !checkEssential) {
                // 	console.log(checkEssential);
                // 	canPopPlaceList.push(_.cloneDeep(bestPathList[i][t]));
                // }
            }

            let canPopPlaceListPoint = [];

            //canPopPlaceList의 시간을 제외한 point를 탐색
            canPopPlaceList.map((item, idx) => {
                //트러블슈팅
                //기존에 canPopPlaceListPointCopy를 활용하여 indexOf를 하다보니까, 같은 점수인 곳이 있으면 똑같은데만 빼려고함
                canPopPlaceListPoint.push({ point: placePoint(selectList, dummy, item, timeLimit), index: idx });
            });

            let canPopPlaceListPointCopy = [];
            //canPopPlaceListPointCopy = [...canPopPlaceListPoint].sort((a, b) => a - b); //오름차순, 낮은 점수부터 빼야함
            canPopPlaceListPointCopy = [...canPopPlaceListPoint].sort((a, b) => a.point - b.point); //오름차순, 낮은 점수부터 빼야함

            //canPopPlaceList에 속한 값들을 빼보면서, 제한 시간 보다 관광지가 적게 맞추는 작업
            for (let x = 0; x < canPopPlaceListPointCopy.length; x++) {
                //let index = canPopPlaceListPoint.indexOf(canPopPlaceListPointCopy[x]); //낮은 점수부터 index에 넣어 빼려는 시도
                let index = canPopPlaceListPointCopy[x].index;
                if (bestPathList[i].length === 1) {
                    break;
                } else {
                    bestPathList[i] = bestPathList[i].filter((item) => item.name != canPopPlaceList[index].name);
                    //placeListCopy에도 추가
                    placeListCopy.push(_.cloneDeep(canPopPlaceList[index]));
                }

                totalTime = 0;
                bestPathList[i].map((item, idx) => {
                    totalTime += bestPathList[i][idx].takenTime;
                });
                //제한 시간보다 적게 되었으면 break
                if (totalTime <= timeLimit - (bestPathList[i].length - 1) * moveTime) {
                    break;
                }
                //canPopPlaceList가 없음. 뺄 수 있는 관광지가 없다는 뜻
                if (canPopPlaceList.length === 0) {
                    break;
                }
                //반복문이 너무 반복되어버렸을 경우. 에러
                x === canPopPlaceListPointCopy.length - 1 &&
                    console.log(
                        'place pop 에러',
                        canPopPlaceList.length,
                        bestPathList[i].length,
                        todayEssentialPlaceList.length
                    );
            }
        }
        //관광지 갯수를 제한시간에 맞춰 pop하는 작업 종료

        //경로 최적화 - 완전 탐색(full search) -> 이를 통해 완벽하게 최적 동선을 계산하여 마무리

        //먼저 현재 코스의 거리합을 계산한다
        let bestSum = 100000000.0;

        //그 후, full search를 통해 최적 경로를 찾는다. 갯수 적어서 ㄱㅊ을듯
        //시간복잡도 O(n!)일거임 아마?
        let tempPath = _.cloneDeep(bestPath);

        //시작 숙소(todayAccomodationList[0])가 있을 경우 - 첫 관광지 고정(숙소)
        if (todayAccomodationList[0].name != '') {
            let tempPlace = _.cloneDeep(tempPath[0]); // 첫 관광지 고정(숙소)

            tempPath = tempPath.filter((item) => item.name != tempPlace.name);
            tempPath = tempPath.filter((item) => item.name != todayAccomodationList[1].name); //미리 빼두고, 나중에 넣음(맨 뒤에 와야해서)

            //첫번째 관광지는 고정이니까
            //console.log('완전탐색 시작');
            searchFullCourse(tempPath, [tempPlace]);
        }
        //시작 숙소(todayAccomodationList[0]가 없을 경우
        else {
            tempPath = tempPath.filter((item) => item.name != todayAccomodationList[1].name); //미리 빼두고, 나중에 넣음(맨 뒤에 와야해서)
            //console.log('완전탐색 시작');
            searchFullCourse(tempPath, []);
        }

        //searchFullCourse의 결과로 나온 모든 코스를 검사함 - corDis 검사
        for (let x = 0; x < corDis.length; x++) {
            if (corDis[x].length === 0) {
                console.log('경로최적화 중 알 수 없는 에러 발생');
                // console.log(bestPathPointList[i]);
                // for (let q = 0; q < corDis.length; q++) {
                // 	console.log(corDis[x].length);
                // }
                // console.log('-------------------------------------');
                break;
            }

            let sum = 0.0;

            let corDisNow = corDis[x]; // 이렇게 해야 x번까지 찾아가는 탐색 시간을 줄일 수 있어서, 빠름!

            // 마지막 숙소가 있을 경우 - 맨 마지막에 넣어줌 - 아까 빼둔거
            todayAccomodationList[1].name != '' && corDis[x].push(_.cloneDeep(todayAccomodationList[1]));

            for (let y = 0; y < corDisNow.length - 1; y++) {
                if (corDisNow[y].lat === 0.0) {
                    continue;
                }
                let latDiff = corDisNow[y].lat - corDisNow[y + 1].lat;
                let longDiff = corDisNow[y].lng - corDisNow[y + 1].lng;

                let dis = Math.sqrt(latDiff ** 2 + longDiff ** 2);
                sum += dis;
            }
            // 코스 길이 합이 짧아졌다면 기존 코스와 교체
            if (sum < bestSum) {
                bestPath = _.cloneDeep(corDisNow);
                bestSum = sum;
            }
        }

        corDis = [];
    }
    return bestPathList;
}

//Step 4. 마지막으로, 완전탐색(재귀)를 통해 코스 최적화 (조합 최적화)
function searchFullCourse(unselectPlaceList, selectPlaceList) {
    //selectPlaceList가 모든 관광지를 가져온 경우
    if (unselectPlaceList.length === 0) {
        corDis.push(_.cloneDeep(selectPlaceList));
        //console.log(selectPlaceList.length);
    }
    //재귀 하향 탐색? selectPlaceList에 관광지 하나씩 넘겨가면서
    unselectPlaceList.map((item, idx) => {
        //selectPlaceList에 하나 선택해서 넣음
        selectPlaceList.push(_.cloneDeep(item));

        //unselectPlaceList에서는 제거 - idx번째부터, 1개 제거 - > filter보다 빠름
        unselectPlaceList.splice(idx, 1);

        //재귀함수 실행
        searchFullCourse(unselectPlaceList, selectPlaceList);

        //다시 복구하여, 다음 반복문을 준비함 - pop 방식으로 수정!
        let popResult = selectPlaceList.pop();

        //idx번째부터 0개 제거, popResult추가
        unselectPlaceList.splice(idx, 0, _.cloneDeep(popResult));

        //2개 이상인 경우는 숙소가 빠지는 경우밖에 없음 - 이거 미리 todayAccomodationList[1]빼놔서 ㄱㅊ
        // if (
        // 	temp - selectPlaceList.length > 1 &&
        // 	(todayAccomodationList[0].name != '' || todayAccomodationList[1].name != '')
        // ) {
        // 	selectPlaceList.splice(0, 0, todayAccomodationList[0]);
        // }
    });
}

async function routeSearch(accomodationList, selectList, essentialPlaceList, timeLimit, nDay) {
    // await안쓰면 이 함수 따로 돌리고 넘어가서, placeList에 원소 안넣은 상태로 코드돌림
    //프리셋 넘버에 따라, 가중치 결정
    for (let i = 0; i < weight.length - 1; i++) {
        weight[i] = weight[i] * (15 - threadNum);
    }

    countNum = 0;

    count.map((item, idx) => {
        if (item > 0) {
            countNum += 1;
        }
    });

    //path의 List,관광지의 List의 List, 날짜별로 한번 더 쪼갠것임
    //pathList[프리셋넘버][n일차넘버][n번째관광지] - 중요!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    //let pathList = [];

    var firstPlace = _.cloneDeep(dummy);

    //preset 반복문 시작 - 프리셋 개수(5번)만큼 반복 - 멀티스레딩이라 안함
    //for (let i = 0; i < numPreset; i++) {
    let arr = [];
    let finalPathList = [];
    for (let i = 0; i < NUM_OF_PATH; i++) {
        finalPathList.push(_.cloneDeep(arr));
    }

    //nDay 반복문 시작 - 날짜만큼 반복
    for (let d = 0; d < nDay; d++) {
        //필수여행지 추가 - map형식임
        let todayEssentialPlaceList = []; // 하루치 필수여행지만 객체 배열로 빼둠
        essentialPlaceList.length > 0 &&
            essentialPlaceList.map((item, idx) => {
                //fixedPlaceDayList의 원소가 d+1(n일차)와 같을때만
                if (item.day === d + 1) {
                    let readData = {
                        name: item.name,
                        lat: item.lat,
                        lng: item.lng,
                        takenTime: item.takenTime,
                        popular: 0,
                        partner: [0, 0, 0, 0, 0, 0, 0],
                        concept: [0, 0, 0, 0],
                        play: [0, 0, 0, 0, 0, 0],
                        tour: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                        season: [0, 0, 0, 0],
                        category: item.category,
                        photo: item.photo,
                    };
                    todayEssentialPlaceList.push(readData);
                }
            });
        //전날 숙소를 지정해뒀을 경우
        if (accomodationList[d].name !== '') {
            firstPlace = _.cloneDeep(accomodationList[d]);

            if (placeListCopy.length < 2) {
                //이러면, 관광지 부족하다는 뜻!, 중단하고 프리셋에서 안내메세지 띄우자
                console.log('남은 관광지 수2222');
                console.log(placeListCopy.length);
                enoughPlace = false;
                break;
            }
        }
        //숙소를 지정해두지 않았을 경우
        else {
            //첫날이면
            if (d === 0) {
                //첫째날 숙소(마지막 장소)가 있을 경우
                if (accomodationList[d + 1].name === '') {
                    let point = [];
                    //모든 관광지의 시간을 제외한 point를 탐색
                    for (let f = 0; f < placeListCopy.length; f++) {
                        point.push(placePoint(selectList, accomodationList[d + 1], placeListCopy[f], timeLimit));
                    }
                    // 점수를 기준으로 sort해서 시작 관광지를 numPreset * day만큼 추출
                    let pointCopy = _.cloneDeep(point);

                    pointCopy = [...point].sort((a, b) => a - b); // 오름차순! index가 뒤쪽부터 시도함

                    // 출발지의 Index, 프리셋마다 다르게 시작하기 위함
                    let index = point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 4]);

                    //if문들을 삼항 연산자로 치환
                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 3]);

                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 2]);

                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum]);

                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1]);

                    if (index < 0) {
                        //이러면, 관광지 부족하다는 뜻!, 중단하고 프리셋에서 안내메세지 띄우자
                        console.log('남은 관광지 수3333');

                        console.log(index);
                        console.log(pointCopy.length);
                        console.log(placeListCopy.length);
                        enoughPlace = false;
                        break;
                    }
                    firstPlace = _.cloneDeep(placeListCopy[index]);
                }

                //첫째날 숙소(마지막 장소)가 없을 경우
                else {
                    let point = [];
                    //모든 관광지의 시간을 제외한 point를 탐색
                    for (let f = 0; f < placeListCopy.length; f++) {
                        point.push(placePoint(selectList, dummy, placeListCopy[f], timeLimit));
                    }
                    // 점수를 기준으로 sort해서 시작 관광지를 numPreset * day만큼 추출
                    let pointCopy = _.cloneDeep(point);
                    pointCopy = [...point].sort((a, b) => a - b); // 오름차순! index가 뒤쪽부터 시도함

                    // 출발지의 Index, 프리셋마다 다르게 시작하기 위함
                    let index = point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 4]);

                    //if문들을 삼항 연산자로 치환
                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 3]);

                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 2]);

                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum]);

                    index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1]);

                    if (index < 0) {
                        //이러면, 관광지 부족하다는 뜻!, 중단하고 프리셋에서 안내메세지 띄우자
                        console.log('남은 관광지 수4444');
                        console.log(placeListCopy.length);
                        enoughPlace = false;
                        break;
                    }
                    firstPlace = _.cloneDeep(placeListCopy[index]);
                }
                //첫날일 경우 종료
            }

            //첫날이 아니면
            else {
                let point = [];
                //모든 관광지의 시간을 제외한 point를 탐색
                for (let f = 0; f < placeListCopy.length; f++) {
                    point.push(
                        placePoint(selectList, finalPathList.at(0).at(-1).at(-1), placeListCopy[f], timeLimit, true)
                    );
                }
                // 점수를 기준으로 sort해서 시작 관광지를 numPreset * day만큼 추출
                let pointCopy = _.cloneDeep(point);

                pointCopy = [...point].sort((a, b) => a - b); // 오름차순! index가 뒤쪽부터 시도함

                // 출발지의 Index, 프리셋마다 다르게 시작하기 위함
                let index = point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 4]);

                //if문들을 삼항 연산자로 치환
                index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 3]);

                index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum * 2]);

                index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1 - threadNum]);

                index = index >= 0 ? index : point.indexOf(pointCopy[pointCopy.length - 1]);

                if (index < 0) {
                    //이러면, 관광지 부족하다는 뜻!, 중단하고 프리셋에서 안내메세지 띄우자
                    console.log('남은 관광지 수5555');
                    console.log(placeListCopy.length);
                    enoughPlace = false;
                    break;
                }

                firstPlace = _.cloneDeep(placeListCopy[index]);
            }
        }

        // 오늘 시간 제한이 너무 짧을 경우...
        if (
            timeLimit[d] <= 1 &&
            (todayEssentialPlaceList.length >= 1 ||
                accomodationList[d].name !== '' ||
                accomodationList[d + 1].name !== '')
        ) {
            let todayPath = [];
            if (accomodationList[d].name !== '') {
                todayPath.push(accomodationList[d]);
            }
            if (todayEssentialPlaceList.length > 0) {
                todayPath = [...todayPath, ...todayEssentialPlaceList];
            }
            if (accomodationList[d + 1].name !== '') {
                todayPath.push(accomodationList[d]);
            }

            for (let i = 0; i < NUM_OF_PATH; i++) {
                finalPathList[i].push(_.cloneDeep(todayPath));
            }

            continue;
        }

        //초기 path 만들기
        let initializePath = await initializeGreedy(selectList, firstPlace, todayEssentialPlaceList, timeLimit[d]);
        //태운 - 임시로 accomodationList 하나 추가해 봄. - 왜 되는지는 모르겠네??
        if (d != nDay - 1 && accomodationList[d + 1].name != '') {
            initializePath.push(_.cloneDeep(accomodationList[d + 1]));
        }

        //날짜 기준으로 사용할 숙소(Accomodation) 2개만 따로 분리. [0]은 시작 숙소, [1]은 끝 숙소
        let todayAccomodationList = [_.cloneDeep(accomodationList[d]), _.cloneDeep(accomodationList[d + 1])];

        //path 개선 - Hill-Climbing으로
        let improvedPathList = hillClimbing(
            initializePath,
            selectList,
            todayAccomodationList,
            todayEssentialPlaceList,
            timeLimit[d]
        );
        for (let i = 0; i < NUM_OF_PATH; i++) {
            finalPathList[i].push(improvedPathList[i]);
        }
    }

    placeListCopy = _.cloneDeep(placeList);

    //parentPort.postMessage({ path: finalPathList, enoughPlaceInThread: enoughPlaceInThread });
    return finalPathList;
    //return pathList;
}

// function ai_run(accomodationList, selectList, essentialPlaceList, time, nDay) {
//     const threads = new Set();
//     return new Promise((resolve, reject) => {
//         //let primeNum = Math.floor(Math.random() * 1000) + 1;
//         //console.time('prime' + primeNum);

//         // 우리가 워커가 일을 할수있게 분배하고 직접 짜야 한다. 여간 복잡한게 아니다..
//         //쓰레드 수 10개! - 나중에 중복 처리하면 줄어든다.
//         for (let i = 0; i < 7; i++) {
//             threads.add(
//                 //이거 경로는 root 폴더를 기준으로 설정해야함. worker가 root폴더에 있기 때문에!!
//                 new Worker('./routes/ai/local_search_ai_thread.js', {
//                     workerData: {
//                         accomodationList: accomodationList,
//                         selectList: selectList,
//                         essentialPlaceList: essentialPlaceList,
//                         time: time,
//                         nDay: nDay,
//                         count: count,
//                         placeList: placeList,
//                         placeListCopy: placeListCopy,
//                         transitInAI: transitInAI,
//                         distanceSensitivityInAI: distanceSensitivityInAI,
//                         selectedNum: selectedNum,
//                         threadNum: threads.size,
//                     },
//                 })
//             );
//         }
//         // 워커들 이벤트 등록
//         for (let worker of threads) {
//             worker.on('error', (err) => {
//                 throw err;
//             });
//             worker.on('message', (message) => {
//                 //console.log('Message from worker:', message);
//                 pathList.push(message.path);

//                 //어떤 스레드에서 enoughPlaceInThread가 false면, enoughPlace도 false!!
//                 if (!message.enoughPlaceInThread) {
//                     console.log('message.enoughPlaceInThread');
//                     console.log(message.enoughPlaceInThread);
//                     enoughPlace = false;
//                 }
//             });
//             //worker.on('exit', resolve);
//             worker.on('exit', () => {
//                 threads.delete(worker);

//                 if (threads.size === 0) {
//                     //console.timeEnd('prime' + primeNum);
//                     //primes = 0;
//                     resolve('성공');
//                 }
//             });
//         }
//     });
// }

//localSearchAI를 실행시키는 비동기 함수
async function localSearchAI(
    regionList,
    accomodationList,
    selectList,
    essentialPlaceList,
    timeLimitArray,
    nDay,
    transit,
    distanceSensitivity
) {
    console.log('여행 코스 AI 시작!');

    //시간 재기
    const startTime = performance.now();

    //데이터 초기화
    enoughPlace = true; //관광지가 부족하여 중단할 경우 false가 됨. -> 다이어로그 표시!

    count = [0, 0, 0, 0, 0]; //selectList 선택 개수 저장 배열

    placeList = []; //장소 리스트, 전역 변수, 원본
    placeListCopy = []; //장소 리스트, 전역 변수, n일차 코스를 위함, path에 들어간 Place들은 제거하는 리스트

    pathList = [];

    //데이터 로딩
    await dataLoading(regionList);
    console.log('전체 관광지 수', placeList.length);

    //AI를 위한 데이터 전처리 시작

    //자차, 대중교통 - 전역변수 저장
    transitInAI = transit;
    distanceSensitivityInAI = distanceSensitivity;

    // ai run 전에 숙소, 필수 여행지를 placeList에서 제거 작업
    let accomodationNum = 0;
    accomodationList.map((item, idx) => {
        if (item.name != '') {
            accomodationNum += 1;
            //placeList에서도 제거해서, 중복 피하기!
            placeList = placeList.filter((itemP) => itemP.name !== item.name);
            placeListCopy = placeListCopy.filter((itemP) => itemP.name !== item.name);
        }
    });

    essentialPlaceList.map((item, idx) => {
        //placeList에도 제거해서, 중복 피하기!
        placeList = placeList.filter((itemP) => itemP.name !== item.name);
        placeListCopy = placeListCopy.filter((itemP) => itemP.name !== item.name);
    });

    // 숙소, 필수여행지 총 합계 계산 + 총날짜도 고려!! - , 반복 횟수 줄이기에 사용
    // 총날짜 (nDay)를 3으로 나눈 몫만큼 빼주자 -> 3일이면 -1, 6일이면 -2 -> 날짜가 많으면 선택 많이해도 지장 줄어드니까
    selectedNum = accomodationNum + essentialPlaceList.length - Math.floor(nDay / 3);

    //selectList 선순회 - placePoint에서 평균 구할 때 사용 - 내부에서 계산하면 시간 오래 걸리니까
    count = [0, 0, 0, 0, 0]; //초기화
    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < selectList[x].length; y++) {
            if (selectList[x][y] == 1) count[x] += 1;
        }
    }

    let timeLimit = 0;
    let time = [];

    //당일치기여행이면, timeLimitArray[0]~timeLimitArray[1]만 생각하면 된다.
    if (nDay == 1) {
        timeLimit = timeLimitArray[1] - timeLimitArray[0];

        // 당일치기라도, 점심 및 저녁 시간이 있으니, 제외하고 계산하기 위함
        timeLimit > 6 ? (timeLimit = timeLimit - 2) : (timeLimit = timeLimit - 1);

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
            timeLimit = 9 * 60;
            time.push(timeLimit);
        }

        timeLimit = timeLimitArray[1] - 11;
        // timeLimit = timeLimit * 60;
        time.push(timeLimit * 60);
    }
    //timeLimit 계산 종료

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

    pathList = []; // 초기화

    //AI를 위한 데이터 전처리 종료

    const loadingTime = performance.now() - startTime;

    //AI 실행
    //await ai_run(accomodationList2, selectList, essentialPlaceList, time, nDay);
    var pathList = await routeSearch(accomodationList2, selectList, essentialPlaceList, time, nDay);

    //여기서, 프리셋 중복을 체크한다. 중복되는 값이 있으면 제거한다. - Set()을 사용하여 빠르게!!!

    const uniqueArrays = new Set(pathList.map(JSON.stringify));
    const resultData = Array.from(uniqueArrays).map(JSON.parse);

    console.log('resultDataresultDataresultDataresultDataresultDataresultData');
    console.log(resultData);

    //시간 재기
    const endTime = performance.now();
    //console.log(resultData);

    if (resultData === [[]]) {
        resultData = [];
    }

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
    console.log(`프리셋 개수`, resultData.length);
    console.log('enoughPlace : ', enoughPlace);
    console.log(`데이터 로딩 및 전처리에 걸리는 시간`);

    console.log(`Elapsed time: ${loadingTime / 1000} seconds`);
    console.log(`AI 돌리는데 걸리는 시간`);

    const elapsedTime = endTime - startTime;

    console.log(`Elapsed time: ${elapsedTime / 1000} seconds`);
    console.log(`------------------------------------------`);

    parentPort.postMessage({ resultData: resultData, enoughPlace: enoughPlace });
    return { resultData: resultData, enoughPlace: enoughPlace };
}

if (isMainThread) {
    console.log('Main Thread');
} else {
    localSearchAI(
        workerData.regionList,
        workerData.accomodationList,
        workerData.selectList,
        workerData.essentialPlaceList,
        workerData.timeLimitArray,
        workerData.nDay,
        workerData.transit,
        workerData.distanceSensitivity
    );
}

//module.exports.localSearchAI = localSearchAI;
//module.exports.enoughPlace = enoughPlace;
