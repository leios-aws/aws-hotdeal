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

var requestEventPage = function (result, callback) {
    var option = {
        uri: 'https://daem.t-monet.com/event/list?title=DD&page=1',
        method: 'GET',
        json: true
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        if (!err && body.data && body.data.list && body.data.count) {
            for (var i = 0; i < body.data.count; i++) {
                var item = {};
                item.title = body.data.list[i].title;
                item.alive = max_alive;
                item.count = 1000;
                item.url = `https://daem.t-monet.com/event/${body.data.list[i].seq}`;
                item.lowestPrice = 100;
                item.price = 100;

                result.data.items.push(item);
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
        requestEventPage,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.qoo10 = result.data.items;
            callback(err, main_result);
        }
    });
};
