const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;

var ignoreProducts = [
    "정관장",
    "아이템매니아",
    "예스24",
    "엔터식스",
    "대한문고 교환권",
    "CGV기프트카드",
    "(롯데마트)",
    "(하이마트)",
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

var requestNaverShoppingSearch = function (result, callback) {
    var option = {
        //uri: 'http://www.wemakeprice.com/main/103900/103912',
        uri: 'https://search.shopping.naver.com/search/all.nhn?query=위메프&pagingSize=80',
        method: 'GET',
        json: true,
        qs: {
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        if (!err) {
            var $ = cheerio.load(body);

            result.naver_link = $('._itemSection').get().reduce(function(prev, curr) {
                if (prev) {
                    return prev;
                }

                var el = $('div.info_mall > p > a.btn_detail._btn_mall_detail', curr);
                if (el) {
                    var data = el.data();
                    if (data && data.mallName && data.mallName === '위메프') {
                        if ($('div.info > div.tit > a', curr).attr('href')) {
                            return $('div.info > div.tit > a', curr).attr('href');
                        } else {
                            return null;
                        }
                    }
                }

                return null;
            }, null);
        }

        //#_search_list > div.search_list.basis > ul
        callback(err, result);
    });
};

var requestNaverShoppingBridge = function (result, callback) {
    var option = {
        //uri: 'http://www.wemakeprice.com/main/103900/103912',
        uri: result.naver_link,
        method: 'GET',
        json: true,
        qs: {
        },
        header: {
            'Referer': 'https://search.shopping.naver.com/search/all.nhn?query=위메프&pagingSize=80'
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        callback(err, result);
    });
};

var requestNaverShoppingWemakeprice = function (result, callback) {
    var option = {
        //uri: 'http://www.wemakeprice.com/main/103900/103912',
        uri: result.naver_link.replace('adcrNoti', 'adcr'),
        method: 'GET',
        json: true,
        qs: {
        },
        header: {
            'Referer': result.naver_link
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        result.naver_bridge = result.response.request.uri.search;

        callback(err, result);
    });
};

var requestListPage = function (result, callback) {
    var option = {
        //uri: 'http://www.wemakeprice.com/main/103900/103912',
        uri: 'http://www.wemakeprice.com/main/get_deal_more/103900/103912',
        method: 'GET',
        json: true,
        qs: {
            r_cnt: 100
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Item List");
        if (!err) {
            var $ = cheerio.load(body.html);
            result.data.items = $('li').map((index, element) => {
                var item = {};

                item.alive = 3;

                var href = $("span.type03 > a", element).attr('href').split('?')[0];
                if (href.startsWith('http')) {
                    item.url = href;
                } else {
                    if (href.endsWith('/103900/')) {
                        item.url = 'http://www.wemakeprice.com' + href.replace(/\/103900\//g, '');
                    } else {
                        item.url = 'http://www.wemakeprice.com' + href;
                    }
                }
                item.bridge = result.naver_bridge;
                item.price = parseInt($("span.type03 > a > span.box_desc > span.txt_info > span.price > span.sale", element).text().replace(/,/g, ''), 10);
                item.title = $("span.type03 > a > span.box_desc > strong.tit_desc", element).text();

                if (item.price < 88000) {
                    return null;
                }
                for (var i = 0; i < ignoreProducts.length; i++) {
                    if (item.title.indexOf(ignoreProducts[i]) > -1) {
                        return null;
                    }
                }
                // 판매 종료
                if (body.html.indexOf('btn_buy_end') > -1) {
                    item.alive = 0;
                }
                // 매진
                if (body.html.indexOf('btn_soldout2') > -1) {
                    item.alive = 0;
                }
                return item;
            }).get();
        }

        callback(err, result);
    });
};

var parseItem = function (item, callback) {
    var option = {
        uri: item.url + item.bridge,
        method: 'GET',
        qs: {
        }
    };

    req(option, function (err, response, body) {
        if (!err) {
            var matches = body.match(/(var aCouponList = .*)/);
            item.couponList = [];
            if (matches && matches.length > 1) {
                console.log(item.url, matches[1]);
                eval(matches[1]);

                item.couponList = aCouponList.map((value, index, array) => {
                    if (value.publish_start_time < now && now <= value.publish_end_time && value.usable_time < now && now <= value.expire_time) {
                        return {
                            coupon_value: value.coupon_value,
                            max_discount_price: value.max_discount_price,
                            min_payment_amount: value.min_payment_amount,
                            //publish_start_time: value.publish_start_time,
                            //publish_end_time: value.publish_end_time,
                            //usable_time: value.usable_time,
                            //expire_time: value.expire_time,
                        };
                    } else {
                        return null;
                    }
                });
            } else {
                console.log(item.url, "Pattern not found!");
            }
        }
        item.lowestPrice = item.couponList.reduce((prev, curr) => {
            var curr_price = item.price;
            for (var i = 0; i < 20; i++) {
                if (curr.min_payment_amount <= (item.price * i)) {
                    curr_price = Math.floor(((item.price * i) - curr.coupon_value) / i);
                    break;
                }
            }
            if (prev > curr_price) {
                return curr_price;
            } else {
                return prev;
            }
        }, item.price);
        callback(err);
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
                naver_link: "",
                naver_bridge: "",
            });
        },
        requestNaverShoppingSearch,
        requestNaverShoppingBridge,
        requestNaverShoppingWemakeprice,
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
            main_result.wemakeprice = result.data.items;
            callback(err, main_result);
        }
    });
};
