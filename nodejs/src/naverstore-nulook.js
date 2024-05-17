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

var requestProductListPage = function (result, callback) {
    var option = {
        uri: 'https://smartstore.naver.com/nulook/category/1acd96c6aa594b6a82d955204bdede15',
        method: 'GET',
        json: false
    };

    console.log("Parsing Item List: naverstore-nulook");

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        //console.log(body.totalCount);
        console.log(body.toString());
        if (!err) {
            var $ = cheerio.load(body);
            result.data.items = $('.V_RECT').map((index, element) => {
                var item = {};

                item.alive = max_alive;
                item.count = 1000;

                var link_element = $('div > a', element);
                var price_element = $('div > a > div > strong > span', element);
                var title_element = $('div > a > strong', element);
                item.url = 'https://smartstore.naver.com' + $(link_element).attr('href');
                item.title = $(title_element).text().trim();
                item.price = parseInt($(price_element).text().replace(/,/g, ''), 10);
                item.lowestPrice = item.price;

                console.log(item.title);
                if (!item.price) {
                    return null;
                }

                var tag_element = $('div > a > div > span', element);
                var tag = $(tag_element).text().trim();
                if (tag === "SOLD OUT") {
                    item.alive = 0;
                }

                return item;
            }).get();
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
        requestProductListPage,
        //requestTrueFriendListPage,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.naverstore = result.data.items;
            callback(err, main_result);
        }
    });
};
