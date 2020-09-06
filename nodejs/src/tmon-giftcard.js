const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;
var max_alive = 2;
var traceProducts = [
    "컬쳐랜드",
    "해피머니",
    "도서문화",
    "롯데",
    "신세계",
    "머니트리",
    "페이코"
];
var ignoreProducts = [
    "아이템베이",
    "이랜드상품권",
    "골프문화상품권",
    "파리크라상",
    "신세계면세점",
    "SPC 해피상품권",
    "컬쳐랜드 지류",
    "LG U+ 데이터",
    "지류상품권",
    "슈퍼세이브"
];

var req = request.defaults({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'ko,en-US;q=0.8,en;q=0.6'
    },
    jar: true,
    gzip: true,
    followAllRedirects: true,
    //encoding: null
});

var requestDelay = function(result, callback) {
    if (result.data.items.length > 0) {
        console.log("Skip retry...");
        callback(null, result);
        return;
    }

    setTimeout(function() {
        console.log("Delayed retry...");
        callback(null, result);
        return;
    }, 1000);
}

var requestListPage = function (result, callback) {
    if (result.data.items.length > 0) {
        console.log("Skip retry...");
        callback(null, result);
        return;
    }
    var option = {
        uri: 'http://www.tmon.co.kr/api/direct/v1/categorylistapi/api/strategy/filter/68090000/deals',
        method: 'GET',
        json: true,
        qs: {
            _: Date.now(),
            platform: 'PC_WEB',
            sortType: 'POPULAR'
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Item List");
        if (!err) {
            if (body && body.data && body.data.items) {
                result.data.items = body.data.items.map(function(item, index) {
                    var convert = {};
                    if (item.titleDesc) {
                        convert.title = item.titleDesc;
                    } else if (item.titleName) {
                        convert.title = item.titleName;
                    } else if (item.title) {
                        convert.title = item.title;
                    } else {
                        return false;
                    }

                    convert.price = item.priceInfo.price;
                    convert.lowestPrice = convert.price;
                    convert.alive = max_alive;

                    if (item.discountPrice) {
                        if (convert.lowestPrice > item.discountPrice.price) {
                            convert.lowestPrice = item.discountPrice.price;
                        }
                        if (convert.lowestPrice > item.discountPrice.tmonPrice) {
                            convert.lowestPrice = item.discountPrice.tmonPrice;
                        }
                        if (convert.lowestPrice > item.discountPrice.originalPrice) {
                            convert.lowestPrice = item.discountPrice.originalPrice;
                        }
                    }

                    convert.url = `http://www.tmon.co.kr/deal/${item.dealNo}`;

                    var majorProduct = false;
                    for (var i = 0; i < traceProducts.length; i++) {
                        if (convert.title.indexOf(traceProducts[i]) > -1) {
                            majorProduct = true;
                        }
                    }
                    if (majorProduct === false) {
                        if (convert.price <= 88000) {
                            return null;
                        }
                    } else {
                        if (convert.price <= 10000) {
                            return null;
                        }
                    }
                    for (var i = 0; i < ignoreProducts.length; i++) {
                        if (convert.title.indexOf(ignoreProducts[i]) > -1) {
                            return false;
                        }
                    }
                    // 판매 종료
                    if (item.isClosed || item.isPause || (item.dealMax && item.dealMax.soldOut)) {
                        convert.alive = 0;
                    }
                    //console.log(convert);
                    return convert;
                }).filter(function(item) {
                    return item;
                });
                //console.log(result.data.items);
            }
        }

        callback(err, result);
    });
};

exports.process = function (main_result, callback) {
    now = Math.floor(Date.now() / 1000);

    async.waterfall([
        function (callback) {
            callback(null, {
                data: {
                    items: [],
                },
                message: "",
            });
        },
        requestListPage,
        requestDelay,
        requestListPage,
        requestDelay,
        requestListPage,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.tmon = result.data.items;
            callback(err, main_result);
        }
    });
};
