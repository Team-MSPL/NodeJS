const firebase = require('firebase/compat/app');
const _ = require('firebase/compat/firestore');
const dotenv = require('dotenv');

dotenv.config(); // .env 파일의 환경 변수 로드

const firebaseConfig = {
    production: true,
    apiKey: process.env.GOOGLE_API_KEY,
    authDomain: 'danim-3439e.firebaseapp.com',
    projectId: 'danim-3439e',
    storageBucket: 'danim-3439e.appspot.com',
    messagingSenderId: '70367155908',
    appId: '1:70367155908:web:39c1344d65ecce16141b91',
    measurementId: 'G-VXZTLNFY84',
};

firebase.initializeApp(firebaseConfig); //1차 정보 접근
const database = firebase.firestore(); //정보가 올바르면 아래 파이어스토어 접근

module.exports.database = database;
