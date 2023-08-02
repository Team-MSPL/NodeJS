import {readAllRegion} from './firebase_read_region';

var _ = require('lodash');

var count = [0, 0, 0, 0, 0]; //selectList 선택 개수 저장 배열
var countNum = 0; // 한 줄당 count 총 갯수

//Step 1. Data Loading
async function dataLoading() {
	let regionList = []; // reset the list

	await readAllRegion()
		.then(res => {
			regionList = [...regionList, ...res];
			//regionListCopy = [...regionListCopy, ...res];
		})
		.catch(err => {
			console.log(err);
		});

	return regionList;
}

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

	const latDiff = targetregion.lat - recentPosition.lat;
	const longDiff = targetregion.lng - recentPosition.lng;

	//대중교통, 자차에 따른 거리민감도 계산 - 삼항 연산자로 간단하게 바꿈
	//latDiff * latDiff와 같은 부분도 거듭 제곱 연산자 **로 바꿈
	//TODO 거리민감도 계산이 확 달라지기에, Math.sqrt를 제거하지 못했음. 추후 제거할 것
	let distance = Math.sqrt(latDiff ** 2 + longDiff ** 2) * (distanceSensitivity * 0.15) * sumForDistance;
	sum -= distance; // 거리가 커질수록 안좋은 것임. 총점수에 - 연산으로 계산해줘야함. 위와 마찬가지로 Math.round()연산 제거
	//sum += 1 / distance;

	return sum;
}

//RegionSearch를 실행시키는 비동기 함수
async function regionSearch({selectList, selectPopular, distanceSensitivity, recentPosition}) {
	console.log('여행 지역 알고리즘 시작!');

	//시간 재기
	const startTime = performance.now();

	//데이터 로딩
	let regionList = await dataLoading();
	console.log('전체 지역 수', regionList.length);

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
		//selectPopular가 범위 안 일때만 계산
		if (item.popular >= selectPopular[0] && item.popular <= selectPopular[1]) {
			regionPointList.push({
				name: item.name,
				point: regionPoint(item, selectList, distanceSensitivity, recentPosition),
			});
		} else {
			regionPointList.push({
				name: item.name,
				point: -100000000,
			});
		}
	});

	regionPointList = regionPointList.sort((a, b) => b.point - a.point);

	let result = [];

	for (let i = 0; i < 5; i++) {
		result.push(regionPointList[i].name);
		console.log(regionPointList[i].point);
	}

	//시간 재기
	const endTime = performance.now();

	console.log(`상위 5개 지역. 성향 선택 개수`, countNum);
	console.log(result);

	console.log(`알고리즘 돌리는데 걸리는 시간`);

	const elapsedTime = endTime - startTime;

	console.log(`Elapsed time: ${elapsedTime / 1000} seconds`);
	console.log(`------------------------------------------`);

	return result;
}
export {regionSearch};
