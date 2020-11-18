const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;
var max_alive = 2;
var traceProducts = [
    "한국투자증권",
];
var ignoreProducts = [
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

var requestDelay = function (result, callback) {
    if (result.data.items.length > 0) {
        console.log("Skip retry...");
        callback(null, result);
        return;
    }

    setTimeout(function () {
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
        uri: 'http://minishop.gmarket.co.kr/coopmktcom/List',
        method: 'GET',
        qs: {
            Category: '200002114'
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Item List: auction - truefriend");
        if (!err) {
            var $ = cheerio.load(body);
            result.data.items = $('.prod_list > ul > li').map((index, element) => {
                var item = {};

                item.alive = max_alive;
                item.count = 1000;

                var link_element = $('.prd_name > a', element);
                var price_element = $('.prd_price > em > strong', element);
                item.url = $(link_element).attr('href');
                item.title = $(link_element).text();
                item.price = parseInt($(price_element).text().replace(/,/g, ''), 10);
                item.lowestPrice = item.price;

                if (!item.price) {
                    return null;
                }

                var majorProduct = false;
                for (var i = 0; i < traceProducts.length; i++) {
                    if (item.title.indexOf(traceProducts[i]) > -1) {
                        majorProduct = true;
                    }
                }
                if (majorProduct === false) {
                    return null;
                }

                /*
                // 판매 종료
                if (body.html.indexOf('btn_buy_end') > -1) {
                    item.alive = 0;
                }
                // 매진
                if (body.html.indexOf('btn_soldout2') > -1) {
                    item.alive = 0;
                }
                */
                return item;
            }).get();
        }

        callback(err, result);
    });
};

var parseItem = function (item, callback) {
    var option = {
        uri: item.url,
        method: 'GET',
        qs: {
        }
    };

    req(option, function (err, response, body) {
        if (!err) {
            var $ = cheerio.load(body);

            var text = $('.uxeslide_item > button > .txt_emp').contents().first().text();
            var matches = text.match(/([0-9]+)/);
            if (matches && matches.length > 1) {
                item.count = parseInt(matches[0]);
            }
        }
        callback(err);
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
                message: "",
            });
        },
        requestListPage,
        requestDelay,
        requestListPage,
        requestDelay,
        requestListPage,
        function (result, callback) {
            async.eachLimit(result.data.items, 5, parseItem, function (err) {
                callback(err, result);
            });
        },
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.gmarket_truefriend = result.data.items;
            callback(err, main_result);
        }
    });
};
