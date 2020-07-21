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
        uri: 'http://browse.gmarket.co.kr/list',
        method: 'GET',
        qs: {
            f: 'p:45000^46500',
            category: '300022520'
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Item List");
        if (!err) {
            var $ = cheerio.load(body);
            // #section--inner_content_body_container > div:nth-child(2) > div:nth-child(2)
            result.data.items = $('.box__component-itemcard').map((index, element) => {
                var item = {};

                item.alive = max_alive;

                //console.log($(element).text());
                $('span > .link__item', element).map((link_index, link_element) => {
                    //console.log($(link_element).attr('href'));
                    item.url = $(link_element).attr('href');
                })

                $('div > span .text__item', element).map((title_index, title_element) => {
                    //console.log($(title_element).text());
                    item.title = $(title_element).text();
                })

                $('div .box__price-original >  .text__value', element).map((price_index, price_element) => {
                    //console.log($(price_element).text());
                    item.price = parseInt($(price_element).text().replace(/,/g, ''), 10);
                })

                $('div .box__price-seller >  .text__value', element).map((price_index, price_element) => {
                    //console.log($(price_element).text());
                    item.lowestPrice = parseInt($(price_element).text().replace(/,/g, ''), 10);
                })

                if (!item.price) {
                    return null;
                }
                if (!item.lowestPrice) {
                    item.lowestPrice = item.price;
                }

                var majorProduct = false;
                for (var i = 0; i < traceProducts.length; i++) {
                    if (item.title.indexOf(traceProducts[i]) > -1) {
                        majorProduct = true;
                    }
                }
                if (majorProduct === false) {
                    if (item.price <= 88000) {
                        return null;
                    }
                } else {
                    if (item.price <= 10000) {
                        return null;
                    }
                }
                for (var i = 0; i < ignoreProducts.length; i++) {
                    if (item.title.indexOf(ignoreProducts[i]) > -1) {
                        return null;
                    }
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
        console.log(result.data.items);

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
            main_result.gmarket = result.data.items;
            callback(err, main_result);
        }
    });
};
