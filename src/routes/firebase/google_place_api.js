const axios = require('axios');
require('dotenv').config();

const axiosGoogle = axios.create({
    baseURL: 'https://maps.googleapis.com/maps/api',
    headers: { 'content-type': 'application/json' },
});

async function getPlaceID(place) {
    let placeID;
    let country;
    let region;
    let name;

    // https://en.wikipedia.org/wiki/Country_code_top-level_domain#Lists
    const COUNTRY_TO_REGION = {
        Korea: 'kr',
        Japan: 'jp',
        China: 'cn',
        Philippines: 'ph',
        Thailand: 'th',
        Vietnam: 'vn',
        Singapore: 'sg',
    };
    if (place.region.startsWith('해외')) {
        // 입력값에서 나라 추출
        const parts = place.region.split('/');

        // 나라에 해당하는 region 값 찾기
        region = COUNTRY_TO_REGION[parts[1] || 'Korea'];
        country = parts[1];
        name = place.name + ', ' + parts[2];
    } else {
        region = 'kr';
        country = 'Korea';
        name = place.name;
    }

    const response = await axiosGoogle.get(
        `/place/textsearch/json?location=${place.lng}%2C${place.lat}&query=${name}&language=ko&region=${region}&radius=10000&key=${process.env.GOOGLE_API_KEY}`
    );

    if (response.statusCode < 200 || response.statusCode > 400) {
        placeID = ''; // Error 반환
    } else if (response.data.status === 'ZERO_RESULTS') {
        placeID = ''; // Error 반환
    } else {
        const filteredResults = response.data.results.filter((result) => result.formatted_address.includes(country));
        if (filteredResults.length > 0) {
            placeID = filteredResults[0].place_id;
        } else {
            placeID = response.data.results[0].place_id;
        }
    }
    return placeID;
}

async function googleKeywordApi(place) {
    let placeIDData = await getPlaceID(place);
    let placeInfo = '';

    if (placeIDData == '') {
        placeInfo = { status: 'failed' }; // Error 반환
    } else {
        const response = await axiosGoogle.get(
            `/place/details/json?place_id=${placeIDData}&fields=photos%2Cname%2Crating%2Cformatted_address%2Creviews%2Cformatted_phone_number%2Copening_hours%2Ceditorial_summary&language=ko&key=${process.env.GOOGLE_API_KEY}`
        );
        if (response.statusCode < 200 || response.statusCode > 400) {
            placeInfo = { status: 'failed' }; // Error 반환
        } else if (response.data.status === 'ZERO_RESULTS') {
            placeInfo = { status: 'failed' }; // Error 반환
        } else {
            placeInfo = { status: 'success', data: response.data.result };
        }
    }
    return placeInfo;
}

module.exports.googleKeywordApi = googleKeywordApi;
