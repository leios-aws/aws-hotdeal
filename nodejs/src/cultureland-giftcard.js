const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;
var max_alive = 2;
var traceProducts = [
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
        uri: 'https://www.cultureland.co.kr/coupon/cpnProdList.do',
        method: 'POST',
        form: {
            cpgm: 'sgc',
            idx: 88
        },
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Item List: cultureland");
        if (!err) {
            var $ = cheerio.load(body);
            // #section--inner_content_body_container > div:nth-child(2) > div:nth-child(2)
            // #contents > div.contents > div.section.sec-tabs > div > div.tab-toggle.tab-toggle-1.active > ul
            result.data.items = $('.brand-items > li').map((index, element) => {
                var item = {};

                item.alive = max_alive;
                item.count = 1000;

                //console.log($(element).text());
                $('a > img', element).map((link_index, link_element) => {
                    //console.log($(link_element).attr('src'));
                    item.url = $(link_element).attr('src');
                })

                $('.item-name', element).map((title_index, title_element) => {
                    //console.log($(title_element).text());
                    item.title = $(title_element).text().trim();
                })

                $('.price', element).map((price_index, price_element) => {
                    //console.log($(price_element).text());
                    item.price = parseInt($(price_element).text().replace(/원/g, '').replace(/,/g, ''), 10);
                    item.lowestPrice = item.price;
                })

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

                $('.soldout', element).map((title_index, title_element) => {
                    item.alive = 0;
                })

                return item;
            }).get();
        }
        //console.log(result.data.items);

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
            main_result.cultureland_giftcard = result.data.items;
            callback(err, main_result);
        }
    });
};
