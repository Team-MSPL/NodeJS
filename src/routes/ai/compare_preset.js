var _ = require('lodash');

let presets = [];

function comparePreset(presetList) {
    for (let p = 0; p < presetList.length; p++) {
        let samePreset = true;
        let arr1 = presetList[p];

        for (let q = 0; q < presets.length; q++) {
            let flag = false;
            let arr2 = presets[q];

            for (let i = 0; i < arr1.length; i++) {
                if (arr1[i].length !== arr2[i].length) {
                    samePreset = false;
                    break;
                }
                for (let j = 0; j < arr1[i].length; j++) {
                    if (arr1[i][j].name !== arr2[i][j].name) {
                        samePreset = false;
                        flag = true;
                        break;
                    }
                }
                if (flag) {
                    break;
                }
            }
        }

        if (!samePreset || p == 0) {
            //첫번째거면 무조건 넣어줘야함!
            presets.push(_.cloneDeep(arr1));
        }
        console.log(p);
    }
    console.log('프리셋 개수 : ', presets.length);
    for (let i = 0; i < presets.length; i++) {
        console.log(`코스`, i + 1);
        for (let j = 0; j < presets[i].length; j++) {
            console.log(`날짜 : ${j + 1}`);
            for (let k = 0; k < presets[i][j].length; k++) {
                console.log(presets[i][j][k].name[0]);
            }
        }
        console.log(`------------------------------------------`);
    }

    //console.log(result);
    console.log(`프리셋 3ㅂ1432432423423423423423개수`, presets.length);
}

function arrayToHash(arr) {
    const hash = {};
    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
            hash[`${i}-${j}`] = arr[i][j].name;
        }
    }
    return hash;
}

function comparePreset2(presetList) {
    let presetHashs = [];
    for (let p = 0; p < presetList.length; p++) {
        let samePreset = true;
        let arr1 = presetList[p];
        const hash1 = arrayToHash(arr1);
        const keys1 = Object.keys(hash1);

        for (let q = 0; q < presetHashs.length; q++) {
            let flag = false;
            let arr2 = presetHashs[q];
            const hash2 = arrayToHash(arr2);
            const keys2 = Object.keys(hash2);

            if (keys1.length !== keys2.length) {
                samePreset = false;
                break;
            }

            for (const key of keys1) {
                if (hash1[key] !== hash2[key]) {
                    samePreset = false;
                    flag = true;
                    break;
                }
            }
            if (flag) {
                break;
            }
        }

        if (!samePreset || p == 0) {
            //첫번째거면 무조건 넣어줘야함!
            presets.push(_.cloneDeep(arr1));
            presetHashs.push(_.cloneDeep(hash1));
        }
    }
    console.log('프리셋 개수 : ', presets.length);
    for (let i = 0; i < presets.length; i++) {
        console.log(`코스`, i + 1);
        for (let j = 0; j < presets[i].length; j++) {
            console.log(`날짜 : ${j + 1}`);
            for (let k = 0; k < presets[i][j].length; k++) {
                console.log(presets[i][j][k].name[0]);
            }
        }
        console.log(`------------------------------------------`);
    }

    //console.log(result);
    console.log(`프리셋 개수`, presets.length);

    let presetList2 = removeDuplicateArrays(presetList);
    console.log(`프리셋 213123123214342개수`, presetList2.length);
}
function removeDuplicateArrays(arrays) {
    const uniqueArrays = new Set(arrays.map(JSON.stringify));
    return Array.from(uniqueArrays).map(JSON.parse);
}
module.exports.comparePreset = comparePreset;
module.exports.comparePreset2 = comparePreset2;
module.exports.comparePreset2 = comparePreset2;
module.exports.presets = presets;
