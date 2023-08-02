const firebase = require('firebase/compat/app');
const _ = require('firebase/compat/firestore');

const firebaseConfig = {
    production: true,
    apiKey: 'AIzaSyAVoHWH5XI2Xe4k2Sz_u_M2YXCUwGcgano',
    authDomain: 'danim-3439e.firebaseapp.com',
    projectId: 'danim-3439e',
    storageBucket: 'danim-3439e.appspot.com',
    messagingSenderId: '70367155908',
    appId: '1:70367155908:web:39c1344d65ecce16141b91',
    measurementId: 'G-VXZTLNFY84',
};

firebase.initializeApp(firebaseConfig); //1차 정보 접근
const database = firebase.firestore(); //정보가 올바르면 아래 파이어스토어 접근

//export default database;

module.exports.database = database;
