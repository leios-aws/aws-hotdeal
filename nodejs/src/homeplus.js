const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;
var max_alive = 2;

var req = request.defaults({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'ko,en-US;q=0.8,en;q=0.6'
    },
    jar: true,
    gzip: true,
    followAllRedirects: true,
    encoding: null
});

var requestSearchPage = function (result, callback) {
    var option = {
        uri: 'https://front.homeplus.co.kr/totalsearch/total/search.json',
        method: 'GET',
        qs: {
            inputKeyword: '보리먹고 자란 돼지',
            searchKeyword: '보리먹고 자란 돼지'
        },
        json: true
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        if (!err && body.data && body.returnStatus && body.data && body.data.dataList) {
            if  (body.returnStatus === 200) {
                for (var i = 0; i < body.data.dataList.length; i++) {
                    if (body.data.dataList[i].itemNm.indexOf("보리먹고 자란 돼지") === 0) {
                        var item = {};
                        item.title = body.data.dataList[i].itemNm;
                        item.alive = max_alive;
                        item.count = 1000;
                        item.url = `https://front.homeplus.co.kr/item?itemNo=${body.data.dataList[i].itemNo}&storeType=HYPER`;
                        item.lowestPrice = body.data.dataList[i].dcPrice;
                        item.price = body.data.dataList[i].salePrice;

                        result.data.items.push(item);
                    }
                }
            }
        }
        callback(err, result);
    });
}

exports.process = function (main_result, callback) {
    now = Math.floor(Date.now() / 1000);

    async.waterfall([
        function (callback) {
            callback(null, {
                data: {
                    items: [],
                },
            });
        },
        requestSearchPage,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.homeplus = result.data.items;
            callback(err, main_result);
        }
    });
};
