const admin = require('firebase-admin');
const serviceAccount = require('./danim-3439e-36fb00b7f31c.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://danim-3439e.firebaseio.com',
    });
}

const database = admin.firestore();

// 관광지명 추출 함수
async function fetchPlaces() {
    const places = [];

    // --- 국내 (예: "강원 강릉시") ---
    for (const region of domesticRegions) {
        const colRef = database.collection(region);
        const snapshot = await colRef.get();
        snapshot.forEach((doc) => {
            if (['관광지 목록', '관광지 정보'].includes(doc.id)) return;
            const data = doc.data();
            if (data.name) {
                places.push({
                    country: 'Korea',
                    region: region,
                    name: data.name,
                });
            }
        });
    }

    // --- 해외 (/해외/{country}/{city}) ---
    const overseasRoot = database.collection('해외');
    const countries = ['China', 'Japan', 'Philippines', 'Singapore', 'Thailand', 'Vietnam'];

    for (const country of countries) {
        const countryRef = overseasRoot.doc(country);
        const subCollections = await countryRef.listCollections();
        for (const cityCol of subCollections) {
            const snapshot = await cityCol.get();
            snapshot.forEach((doc) => {
                if (['관광지 목록', '관광지 정보'].includes(doc.id)) return;
                const data = doc.data();
                if (data.name) {
                    places.push({
                        country: country,
                        region: cityCol.id,
                        name: data.name,
                    });
                }
            });
        }
    }

    return places;
}

const domesticRegions = [
    '강원 강릉시',
    '강원 고성군',
    '강원 동해시',
    '강원 삼척시',
    '강원 속초시',
    '강원 양구군',
    '강원 양양군',
    '강원 영월군',
    '강원 원주시',
    '강원 인제군',
    '강원 정선군',
    '강원 철원군',
    '강원 춘천시',
    '강원 태백시',
    '강원 평창군',
    '강원 홍천군',
    '강원 화천군',
    '강원 횡성군',
    '경기 가평군',
    '경기 고양시',
    '경기 과천시',
    '경기 광명시',
    '경기 광주시',
    '경기 구리시',
    '경기 군포시',
    '경기 김포시',
    '경기 남양주시',
    '경기 동두천시',
    '경기 부천시',
    '경기 성남시',
    '경기 수원시',
    '경기 시흥시',
    '경기 안산시',
    '경기 안성시',
    '경기 안양시',
    '경기 양주시',
    '경기 양평군',
    '경기 여주시',
    '경기 연천군',
    '경기 오산시',
    '경기 가평군',
    '경기 고양시',
    '경기 과천시',
    '경기 광명시',
    '경기 광주시',
    '경기 구리시',
    '경기 군포시',
    '경기 김포시',
    '경기 남양주시',
    '경기 동두천시',
    '경기 부천시',
    '경기 성남시',
    '경기 수원시',
    '경기 시흥시',
    '경기 안산시',
    '경기 안성시',
    '경기 안양시',
    '경기 양주시',
    '경기 양평군',
    '경기 여주시',
    '경기 연천군',
    '경기 오산시',
    '경기 용인시',
    '경기 의왕시',
    '경기 의정부시',
    '경기 이천시',
    '경기 파주시',
    '경기 평택시',
    '경기 포천시',
    '경기 하남시',
    '경기 화성시',
    '경남 거제시',
    '경남 거창군',
    '경남 고성군',
    '경남 김해시',
    '경남 남해군',
    '경남 밀양시',
    '경남 사천시',
    '경남 산청군',
    '경남 양산시',
    '경남 의령군',
    '경남 진주시',
    '경남 창녕군',
    '경남 창원시',
    '경남 통영시',
    '경남 하동군',
    '경남 함안군',
    '경남 함양군',
    '경남 합천군',
    '경북 경산시',
    '경북 경주시',
    '경북 고령군',
    '경북 구미시',
    '경북 김천시',
    '경북 문경시',
    '경북 봉화군',
    '경북 상주시',
    '경북 성주군',
    '경북 안동시',
    '경북 영덕군',
    '경북 영양군',
    '경북 영주시',
    '경북 영천시',
    '경북 예천군',
    '경북 울릉군',
    '경북 울진군',
    '경북 의성군',
    '경북 청도군',
    '경북 청송군',
    '경북 칠곡군',
    '경북 포항시',
    '광주 전체',
    '대구 전체',
    '대전 전체',
    '부산 전체',
    '서울 도심권',
    '서울 동남권',
    '서울 동북권',
    '서울 서남권',
    '서울 서북권',
    '세종 전체',
    '울산 전체',
    '인천 전체',
    '전남 강진군',
    '전남 고흥군',
    '전남 곡성군',
    '전남 광양시',
    '전남 구례군',
    '전남 나주시',
    '전남 담양군',
    '전남 목포시',
    '전남 무안군',
    '전남 보성군',
    '전남 순천시',
    '전남 신안군',
    '전남 여수시',
    '전남 영광군',
    '전남 영암군',
    '전남 완도군',
    '전남 장성군',
    '전남 장흥군',
    '전남 진도군',
    '전남 함평군',
    '전남 해남군',
    '전남 화순군',
    '전북 고창군',
    '전북 군산시',
    '전북 김제시',
    '전북 남원시',
    '전북 무주군',
    '전북 부안군',
    '전북 순창군',
    '전북 완주군',
    '전북 익산시',
    '전북 임실군',
    '전북 장수군',
    '전북 전주시',
    '전북 정읍시',
    '전북 진안군',
    '제주 서귀포시',
    '제주 제주시',
    '충남 계룡시',
    '충남 공주시',
    '충남 금산군',
    '충남 논산시',
    '충남 당진시',
    '충남 보령시',
    '충남 부여군',
    '충남 서산시',
    '충남 서천군',
    '충남 아산시',
    '충남 예산군',
    '충남 천안시',
    '충남 청양군',
    '충남 태안군',
    '충남 홍성군',
    '충북 괴산군',
    '충북 단양군',
    '충북 보은군',
    '충북 영동군',
    '충북 옥천군',
    '충북 음성군',
    '충북 제천시',
    '충북 증평군',
    '충북 진천군',
    '충북 청주시',
    '충북 충주시',
];

module.exports.fetchPlaces = fetchPlaces;
