const axios = require('axios');
require('dotenv').config();

const axiosGoogle = axios.create({
    baseURL: 'https://maps.googleapis.com/maps/api',
    headers: { 'content-type': 'application/json' },
});

async function getPlaceID(place) {
    let placeID;

    const response = await axiosGoogle.get(
        '/place/textsearch/json?location=${place.lng}%2C${place.lat}&query=${place.name}&language=ko&radius=10000&key=${process.env.GOOGLE_API_KEY}'
    );

    if (response.statusCode < 200 || response.statusCode > 400) {
        placeID = ''; // Error 반환
    } else {
        placeID = response.data.result;
    }
    return placeID;
}

async function googleKeywordApi(place) {
    let placeIDData = await getPlaceID(place);
    let placeInfo = '';

    if (placeIDData == '') {
        placeInfo = { status: 'failed', message: '정보가 없습니다.' }; // Error 반환
    } else {
        const response = await axiosGoogle.get(
            '/place/details/json?place_id=${placeIDData.data.results[0].place_id}&fields=photos%2Cname%2Crating%2Cformatted_address%2Creviews%2Cformatted_phone_number%2Copening_hours%2Ceditorial_summary&language=ko&key=${process.env.GOOGLE_API_KEY}'
        );
        if (response.statusCode < 200 || response.statusCode > 400) {
            placeInfo = { status: 'failed', message: '정보가 없습니다.' }; // Error 반환
        } else {
            placeInfo = response.data.result;
        }
    }
    return placeInfo;
}

module.exports.googleKeywordApi = googleKeywordApi;
