const axios = require('axios');
require('dotenv').config();

const axiosGoogle = axios.create({
    baseURL: 'https://maps.googleapis.com/maps/api',
    headers: { 'content-type': 'application/json' },
});

async function getPlaceGeo(place) {
    let placeGeo;

    const response = await axiosGoogle.get(
        `/place/findplacefromtext/json?input=${encodeURIComponent(
            place.region + ' ' + place.name
        )}&inputtype=textquery&fields=formatted_address%2Cname%2Cgeometry&key=${process.env.GOOGLE_API_KEY}`
    );

    if (response.statusCode < 200 || response.statusCode > 400) {
        placeGeo = { lat: 0.0, lng: 0.0 }; // Error 반환
    } else if (response.data.status === 'ZERO_RESULTS') {
        placeGeo = { lat: 0.0, lng: 0.0 }; // Error 반환
    } else {
        placeGeo = response.data.candidates[0];
    }
    return placeGeo;
}

async function googleGeoApi(place) {
    let placeGeoInfo = await getPlaceGeo(place);

    return placeGeoInfo;
}

module.exports.googleGeoApi = googleGeoApi;
