const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;
var max_alive = 2;

var req = request.defaults({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'ko,en-US;q=0.8,en;q=0.6'
    },
    jar: true,
    gzip: true,
    followAllRedirects: true,
    encoding: null
});

var requestWisparmPage = function (result, callback) {
    var option = {
        uri: 'https://m.qoo10.com/gmkt.inc/mobile/wisfarm/wisfarmlist.aspx',
        method: 'GET',
        json: false
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        //console.log(body + "");
        if (!err) {
            var $ = cheerio.load(body);

            result.data.itemsWisparm = $('#div_onsubscribe_list > div > ul > li').map((index, element) => {
                var url = $("a.sbj", element).attr("href");
                if (!url) {
                    return null;
                }
                var id = $("a.sbj", element).attr("title")

                var item = {};
                item.title = `Qoo10 위시팜: ${id}`;
                item.alive = max_alive;
                item.count = 1000;
                item.url = url;
                item.lowestPrice = 100;
                item.price = 100;

                return item;

            }).get();
        }
        callback(err, result);
    });
}


var requestTimeLinePage = function (result, callback) {
    var option = {
        uri: 'https://m.qoo10.com/gmkt.inc/Mobile/ShoppingTweet/TimeLine.aspx',
        method: 'GET',
        json: false
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        if (!err) {
            var $ = cheerio.load(body);

            result.data.itemsMameqoo = $('#ul_shopping_tweet_push_list > li').map((index, element) => {
                if ($(".cmt", element).html() != null) {
                    var url = $("a", element).attr("href");
                    if (!url) {
                        return null;
                    }
                    var id = $(".tt", element).html()

                    var item = {};
                    item.title = `Qoo10 마메큐: ${id}`;
                    item.alive = max_alive;
                    item.count = 1000;
                    item.url = url;
                    item.lowestPrice = 100;
                    item.price = 100;
                    return item
                }
                return null;
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
                    itemsWisparm: [],
                    itemsMameqoo: [],
                },
            });
        },
        requestWisparmPage,
        requestTimeLinePage,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.qoo10 = [].concat(result.data.itemsWisparm, result.data.itemsMameqoo);
            callback(err, main_result);
        }
    });
};
