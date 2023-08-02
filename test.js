const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
//var primes = require('./test2.js');

//let min = 2,
//    max = 10_000_000;
var primes = 0;

// 아리토스테네스의 체 소수구하기

function generatePrimes(start, range, min) {
    let isPrime = true;
    const end = start + range;
    for (let i = start; i < end; i++) {
        for (let j = min; j < Math.sqrt(end); j++) {
            if (i != j && i % j == 0) {
                isPrime = false;
                break;
            }
        }

        if (isPrime) {
            primes += 1;
        }
        isPrime = true;
    }
}

if (isMainThread) {
    console.log('Main Thread');
} else {
    generatePrimes(workerData.start, workerData.range);
    console.log(primes);
    parentPort.postMessage(primes);
}
