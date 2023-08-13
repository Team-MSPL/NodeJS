const mongoose = require('mongoose');
const dotenv = require('dotenv');

const connect = async () => {
    if (process.env.NODE_ENV !== 'production') {
        mongoose.set('debug', true);
    }

    // 이전 코드 (콜백 사용)
    // mongoose.connect(
    //     'mongodb://root:root@localhost:8080/danim_database',
    //     {
    //         dbName: 'mongo',
    //         useNewUrlParser: true,
    //         userCreateIndex: true,
    //     },
    //     (error) => {
    //         if (error) {
    //             console.log('몽고디비 연결 에러', error);
    //         } else {
    //             console.log('몽고디비 연결 성공');
    //         }
    //     }
    // );
    // 수정된 코드 (프로미스 사용)
    dotenv.config();
    await mongoose
        //.connect('mongodb://54.180.92.25/danim_database', {
        .connect('mongodb://127.0.0.1/danim_database', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            //bufferCommands: false,
        })
        .then(() => {
            console.log('Connected to MongoDB');
        })
        .catch((err) => {
            console.error('Error connecting to MongoDB:', err);
        });
};

mongoose.connection.on('error', (error) => {
    console.error('몽고디비 연결 에러', error);
});

mongoose.connection.on('disconnected', () => {
    console.error('몽고디비 연결이 끊겼습니다. 연결을 재시도 합니다');
    connect();
});

module.exports = connect;
