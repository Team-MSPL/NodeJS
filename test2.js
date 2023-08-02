const { Worker, isMainThread, parentPort } = require('worker_threads');

let min = 2,
    max = 10_000_000,
    primes = 0;

function test_function() {
    return new Promise((resolve, reject) => {
        const threadCount = 8;
        const threads = new Set();
        const range = Math.ceil((max - min) / threadCount); // 10_000_000 max를 8개의 쓰레드에 분배를 해서 처리하기 위해서

        let start = 2;
        let primeNum = Math.floor(Math.random() * 1000) + 1;
        console.time('prime' + primeNum);

        if (isMainThread) {
            // 우리가 워커가 일을 할수있게 분배하고 직접 짜야 한다. 여간 복잡한게 아니다..
            primes = 0;
            for (let i = 0; i < threadCount - 1; i++) {
                const wStart = start;
                threads.add(new Worker('./test.js', { workerData: { start: wStart, range: range, min: min } }));
                start += range;
            }
            // 7개만 for돌고 마지막 워커는 특별해서 따로 지정
            threads.add(
                new Worker('./test.js', {
                    workerData: { start: start, range: range + ((max - min + 1) % threadCount), min: min },
                })
            );
            // 워커들 이벤트 등록

            for (let worker of threads) {
                worker.on('error', (err) => {
                    throw err;
                });
                //worker.on('exit', resolve);
                worker.on('exit', () => {
                    threads.delete(worker);

                    if (threads.size === 0) {
                        console.timeEnd('prime' + primeNum);
                        console.log(primes);
                        primes = 0;
                        resolve('성공?');
                    }
                });

                // 워커들이 일한 결과를 메시지 받아서 정리해주는 동작도 직접 구현
                worker.on('message', (msg) => {
                    //primes = primes.concat(msg);
                    primes += msg;
                });
            }
        }
    });
}
async function test_function_run() {
    const result = await test_function();
    console.log(primes);
}

//run().catch((err) => console.error(err));

module.exports.test_function_run = test_function_run;
module.exports.primes = primes;
