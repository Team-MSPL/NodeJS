const express = require('express');
const router = express.Router();
const BookingProduct = require('../schemas/booking_product.js');
const User = require('../schemas/user.js');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const axios = require('axios');
const nodemailer = require('nodemailer');
var _ = require('lodash');

const KKDAY_BASE_URL = 'https://api-b2d.kkday.com/v4';
const KKDAY_API_KEY = process.env.KKDAY_API_KEY;

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.ADMIN_EMAIL_USER,
        pass: process.env.ADMIN_EMAIL_PASS,
    },
});

// KKday API 호출 헬퍼 - get
async function kkdayGet(endpoint, params = {}) {
    const { data } = await axios.get(`${KKDAY_BASE_URL}/${endpoint}`, {
        headers: {
            Authorization: KKDAY_API_KEY,
            'Content-Type': 'application/json',
        },
        params, // GET 요청에서는 body가 아니라 params로 전달
    });
    return data;
}

// KKday API 호출 헬퍼 - post
async function kkdayPost(endpoint, body = {}) {
    const { data } = await axios.post(`${KKDAY_BASE_URL}/${endpoint}`, body, {
        headers: {
            Authorization: KKDAY_API_KEY,
            'Content-Type': 'application/json',
        },
    });
    return data;
}

// 1. Search API - 상품 검색
router.post('/Search', async (req, res) => {
    const {
        keywords = '', // 🔍 키워드 기본값
        locale = 'ko', // 🌐 언어 설정
        cat_keys, // 🏷️ 카테고리 키
        city_keys, // 🏙️ 도시 키
        country_keys = '', // 🌍 국가 키 기본값 - A01-004 ( 한국 )
        date_from, // 📅 시작일
        date_to, // 📅 종료일
        durations, // ⏱️ 소요 시간 범위
        facets, // 📊 통계 필드
        guide_langs, // 🗣️ 가이드 언어
        has_pkg, // 📦 패키지 포함 여부
        have_translate, // 🌐 번역 여부
        instant_booking, // ⚡ 실시간 예약 여부
        page_size = 20, // 📄 페이지당 상품 수
        price_from, // 💰 최소 가격
        price_to, // 💰 최대 가격
        product_categories, // 🧩 신 카테고리 키
        sort = 'DEFAULT', // 🔽 정렬 기준 - PDESC 등
        start = '0', // ⏩ 시작 인덱스
        state = '', // 🗾 지역 코드
        stats, // 📈 가격 통계
        tourism, // 🎒 관광 유형 (01: 일반여행, 00: 기념품)
    } = req.body;

    // JWT 토큰 검증
    dotenv.config(); // .env 파일의 환경 변수 로드

    const toArray = (val) => {
        if (!val) return null;
        if (Array.isArray(val)) return val;
        return val.split(','); // 문자열이면 쉼표로 분리
    };

    const countryData = await kkdayGet('Common/QueryCountryInfo', { locale: 'ko' });

    // 국가/도시 코드 변환
    const { country_code, city_code, error } = findKKdayCode(countryData, {
        countryInput: req.body.country_keys,
        cityInput: req.body.city_keys,
    });

    // console.log('country_code');
    // console.log(country_code);
    // console.log('city_code');
    // console.log(city_code);

    if (error) return res.status(400).json({ error });

    const requestBody = {
        locale,
        ...(keywords && { keywords }),
        ...(cat_keys && { cat_keys: toArray(cat_keys) }),
        ...(country_code && { country_keys: [country_code] }),
        ...(city_code && { city_keys: city_code }),
        ...(date_from && { date_from }),
        ...(date_to && { date_to }),
        ...(durations && { durations: toArray(durations) }),
        ...(facets && { facets: toArray(facets) }),
        ...(guide_langs && { guide_langs: toArray(guide_langs) }),
        ...(has_pkg !== undefined && { has_pkg: has_pkg === true || has_pkg === 'true' }),
        ...(have_translate !== undefined && { have_translate: have_translate === true || have_translate === 'true' }),
        ...(instant_booking && { instant_booking }),
        ...(page_size && { page_size: parseInt(page_size) }),
        ...(price_from && { price_from: parseFloat(price_from) }),
        ...(price_to && { price_to: parseFloat(price_to) }),
        ...(product_categories && { product_categories: toArray(product_categories) }),
        ...(sort && { sort }),
        ...(start && { start }),
        ...(state && { state }),
        ...(stats && { stats: toArray(stats) }),
        ...(tourism && { tourism }),
    };

    // console.log('requestBody');
    // console.log(requestBody);

    try {
        const data = await kkdayPost('Search', requestBody);
        res.status(200).json(data);
    } catch (error) {
        console.error('KKday API Error:', error);
        res.status(500).json({
            message: 'KKday API 호출 실패',
            error: error.message,
        });
    }
});

// 1-2. QueryCategories
router.get('/Search/QueryCategories/:locale', async (req, res) => {
    try {
        const locale = req.params.locale || req.query.locale || 'ko';

        const data = await kkdayGet(`Search/QueryCategories/${locale}`);

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/*
 ** 2~8번 : Product 관련 - TODO - 한 번의 요청으로 여러 정보를 줄 수 있게 합치는 과정 진행 필요?
 */

// 2. QueryProduct API - 상품 상세
router.post('/Product/QueryProduct', async (req, res) => {
    try {
        const { prod_no } = req.body;

        const data = await kkdayPost('Product/QueryProduct', {
            prod_no,
            locale: 'ko',
        });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. QueryPackage API - 패키지 상세/가격/캘린더
router.post('/Product/QueryPackage', async (req, res) => {
    try {
        const { prod_no, pkg_no, s_date, e_date } = req.body;

        const data = await kkdayPost('Product/QueryPackage', {
            prod_no,
            pkg_no,
            locale: 'ko',
            ...(s_date && { s_date }),
            ...(e_date && { e_date }),
        });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. QueryBookingField API - 필수 예약 필드 조회
router.post('/Product/QueryBookingField', async (req, res) => {
    try {
        const { prod_no, pkg_no, s_date, e_date } = req.body;

        const data = await kkdayPost('Product/QueryBookingField', {
            prod_no,
            pkg_no,
            locale: 'ko',
            ...(s_date && { s_date }),
            ...(e_date && { e_date }),
        });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. QueryAllotment API - 재고 확인
router.post('/Product/QueryAllotment', async (req, res) => {
    try {
        const { prod_no, pkg_no, s_date, e_date } = req.body;

        const data = await kkdayPost('Product/QueryAllotment', {
            prod_no,
            pkg_no,
            locale: 'ko',
            ...(s_date && { s_date }),
            ...(e_date && { e_date }),
        });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. QueryDescription API
router.post('/Product/QueryDescription', async (req, res) => {
    try {
        const { prod_no } = req.body;

        const data = await kkdayPost('Product/QueryDescription', {
            prod_no,
            locale: 'ko',
        });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. QueryBackupEvent API
router.post('/Product/QueryBackupEvent', async (req, res) => {
    try {
        const { pkg_no, go_date, event_time, skus } = req.body;

        const data = await kkdayPost('Product/QueryBackupEvent', {
            pkg_no,
            locale: 'ko',
            ...(go_date && { go_date }),
            ...(event_time && { event_time }),
            ...(skus && { skus }),
        });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. QueryReview API - 리뷰
router.post('/Product/QueryReview', async (req, res) => {
    try {
        const { prod_no, page_size, current_page } = req.body;

        const data = await kkdayPost('Product/QueryReview', {
            prod_no,
            locale: 'ko',
            ...(page_size && { page_size }),
            ...(current_page && { current_page }),
        });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//////////////////////////////// TODO - 이 밑은 아직 다듬기 전

/*
 ** 9~10번 : Booking 관련 - TODO - 한 번의 요청으로 여러 정보를 줄 수 있게 합치는 과정 진행 필요?
 */

// 9. QueryAmount API
router.post('/Booking/QueryAmount', async (req, res) => {
    try {
        const data = await kkdayPost('Booking/QueryAmount', req.body);
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Booking API - 예약 요청
router.post('/Booking', async (req, res) => {
    let resultData = null;
    const { prod_no, pkg_no } = req.body;
    try {
        console.log(req.body);

        resultData = await kkdayPost('Booking', {
            prod_no,
            pkg_no,
            locale: 'ko',
            ...req.body,
        });

        console.log(resultData);

        if (resultData.result !== '00') {
            return res.status(500).json({ error: `구매에 실패하였습니다.`, data: resultData });
        }
        res.status(200).json({ data: resultData });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message, data: resultData });
    }
});

/*
 ** 11~14번 : Order 관련 - TODO - 한 번의 요청으로 여러 정보를 줄 수 있게 합치는 과정 진행 필요?
 */

// 11. QueryOrders API
router.post('/Order/QueryOrders', async (req, res) => {
    try {
        const data = await kkdayPost('Order/QueryOrders', { locale: 'ko', ...req.body });
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. QueryOrderDtl API
router.get('/Order/QueryOrderDtl/:order_no', async (req, res) => {
    try {
        const order_no = req.params.order_no || req.query.order_no;

        const data = await kkdayGet(`Order/QueryOrderDtl/${order_no}`);

        res.status(200).json(data);
    } catch (err) {
        console.error('QueryOrderDtl 에러:', err);
        res.status(500).json({ error: err.message });
    }
});

// 13. QueryOrderDtlInfo API
router.get('/Order/QueryOrderDtlInfo/:order_no', async (req, res) => {
    try {
        const order_no = req.params.order_no || req.query.order_no;

        const data = await kkdayGet(`Order/QueryOrderDtlInfo/${order_no}`);
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 14. Cancel API - 몽고디비 bookingProduct에서 같이 삭제
router.post('/Order/Cancel', async (req, res) => {
    try {
        const { order_no } = req.body;

        const data = await kkdayPost('Order/Cancel', req.body);

        // 몽고디비 bookingProduct에서 같이 비활성화
        BookingProduct.findOneAndUpdate(
            { order_no: order_no }, // 조건: order_no로 검색
            { isActive: false }, // 업데이트할 내용
            { new: true } // 업데이트 후 결과 반환
        )
            .then((updatedBookingProduct) => {
                if (!updatedBookingProduct) {
                    return res.status(404).json({ message: '삭제할 예약 상품을 찾을 수 없습니다.' });
                }

                res.status(200).json(data); // KKday 응답 데이터도 함께 반환
            })
            .catch((error) => {
                console.error('BookingProduct.findOneAndUpdate() 함수에 문제 발생 : ', error);
                res.status(500).json({ error: error.message, data: data });
            });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/*
 ** 15~16번 : Voucher 관련 - TODO - 한 번의 요청으로 여러 정보를 줄 수 있게 합치는 과정 진행 필요?
 */

// 15. QueryVoucherList API - 바우처 조회
router.post('/Voucher/QueryVoucherList', async (req, res) => {
    try {
        const data = await kkdayPost('Voucher/QueryVoucherList', req.body);
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 16. Download API - 바우처 Download
router.post('/Voucher/Download', async (req, res) => {
    try {
        const data = await kkdayPost('Voucher/Download', req.body);
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/*
 ** 17~19번 : Common 관련 - TODO - 한 번의 요청으로 여러 정보를 줄 수 있게 합치는 과정 진행 필요?
 */

router.get('/Common/QueryState', async (req, res) => {
    try {
        const data = await kkdayGet('Common/QueryState', { locale: 'ko' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/Common/QueryCountryInfo', async (req, res) => {
    try {
        const data = await kkdayGet('Common/QueryCountryInfo', { locale: 'ko' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/Common/QueryIsoCountryInfo', async (req, res) => {
    try {
        const data = await kkdayGet('Common/QueryIsoCountryInfo', { locale: 'ko' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// KKday 국가·도시 코드 변환 함수
function findKKdayCode(countryData, { countryInput, cityInput }) {
    if (!countryInput) return { country_code: null, city_code: null };

    const isCodeFormat = (str) => /^A\d{2}-\d{3,}$/.test(str);

    // 국가 코드 직접 입력
    if (isCodeFormat(countryInput)) {
        if (!cityInput) return { country_code: countryInput };
        if (Array.isArray(cityInput)) {
            const codes = cityInput.filter((c) => c); // 존재 여부는 API에서 체크
            return { country_code: countryInput, city_code: codes.length ? codes : undefined };
        }
        return { country_code: countryInput, city_code: [cityInput] };
    }

    // 국가명 검색
    const country = countryData.countries.find(
        (c) => c.country_name.trim().toLowerCase() === countryInput.trim().toLowerCase()
    );
    if (!country) return { error: `국가 "${countryInput}"를 찾을 수 없습니다.` };

    // 도시 입력 없으면 국가 코드만 반환
    if (!cityInput) return { country_code: country.country_code };

    // 도시 배열이면 매칭되는 것만 반환
    if (Array.isArray(cityInput)) {
        const codes = cityInput
            .map((cityName) => {
                if (isCodeFormat(cityName)) return cityName;
                const city = country.cities.find(
                    (ct) => ct.city_name.trim().toLowerCase() === cityName.trim().toLowerCase()
                );
                return city ? city.city_code : null;
            })
            .filter(Boolean);

        // 매칭되는 도시가 하나도 없으면 undefined → 국가 전체 검색
        return { country_code: country.country_code, city_code: codes.length ? codes : undefined };
    }

    // 단일 도시명
    if (isCodeFormat(cityInput)) return { country_code: country.country_code, city_code: [cityInput] };

    const city = country.cities.find((ct) => ct.city_name.trim().toLowerCase() === cityInput.trim().toLowerCase());

    // 매칭 안 되면 도시 코드 없이 국가 코드만 반환
    if (!city) return { country_code: country.country_code };

    return { country_code: country.country_code, city_code: [city.city_code] };
}

// 예약 + 이메일까지 보내기

// ---------------------------
// 1. 예약 생성 함수
// ---------------------------
async function createBooking(bookingData) {
    try {
        const response = await kkdayPost('Booking', bookingData);
        console.log(response);
        return response.data;
    } catch (err) {
        console.error('Booking API Error:', err.response?.data || err.message);
        throw err;
    }
}

// ---------------------------
// 2. 바우처 조회 함수
// ---------------------------
async function getVoucherList(orderNo) {
    try {
        const response = await kkdayPost('Voucher/QueryVoucherList', { order_no: orderNo });
        return response.data.item || [];
    } catch (err) {
        console.error('Voucher API Error:', err.response?.data || err.message);
        throw err;
    }
}

// ---------------------------
// 3. 이메일 발송 함수
// ---------------------------
async function sendVoucherEmail(toEmail, orderNo, vouchers) {
    const voucherLinks = vouchers.map((v) => `<li><a href="${v.download_url}">${v.voucher_no}</a></li>`).join('');

    const mailOptions = {
        from: 'wayfarers0814@gmail.com',
        to: toEmail,
        subject: `구매가 완료되었습니다! 예약번호 : ${orderNo}`,
        html: `<p>다님으로 여행 상품을 구매해주셔서 감사드립니다!</p>
               <ul>${voucherLinks}</ul>
               <p>즐거운 여행 되시길 바랍니다!</p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`바우처 전송 : ${toEmail}`);
}

// ---------------------------
// 4. 전체 프로세스 실행 예시
// ---------------------------
async function processBooking(data) {
    // 1) 예약 데이터 구성
    const bookingData = {
        item_no: [1565430],
        travel_date: '2025-08-23',
        qty: 1,
        psg_info: [{ first_name: 'John', last_name: 'Doe', email: 'customer@example.com' }],
        // 필요 시 traffic, mobile_device 등 필드 추가
    };

    try {
        // 2) 예약 생성
        const bookingResult = await createBooking(data);

        console.log('bookingResult');
        console.log(bookingResult);

        const orderNo = bookingResult.order_no;
    } catch (err) {
        console.error('Error in booking process:', err);
        return { error: `구매에 실패하였습니다.` };
    }

    /*
    0|server | {
0|server |   result: '00',
0|server |   result_msg: 'OK',
0|server |   order_no: '25KK217710796',
0|server |   order_oid: '40018788',
0|server |   order_master_mid: '25MM293002260'
0|server | }
    */

    try {
        // 3) 바우처 조회
        const vouchers = await getVoucherList(orderNo);
        console.log('vouchers');
        console.log(vouchers);

        // 4) 이메일 발송
        await sendVoucherEmail(data.buyer_Email, orderNo, vouchers);
        return { vouchers: vouchers, success: `구매해주셔서 감사드립니다!` };
    } catch (err) {
        console.error('Error in booking process:', err);
        return { error: `이메일 발송에 실패하였습니다.` };
    }
}

// 예약 + 이메일까지 보내기
router.post('/BookingWithEmail', async (req, res) => {
    try {
        const { prod_no, pkg_no } = req.body;

        const { vouchers, success, error } = await processBooking({
            prod_no,
            pkg_no,
            locale: 'ko',
            ...req.body,
        });

        if (error) return res.status(400).json({ error: error });

        res.status(200).json({ vouchers: vouchers, success: success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
