const request = require('request');
const async = require('async');
const wemakeprice_giftcard = require('./src/wemakeprice-giftcard.js');
const tmon_giftcard = require('./src/tmon-giftcard.js');
const config = require('config');
const AWS = require('aws-sdk');
const commaNumber = require('comma-number');

AWS.config.update({
    region: 'ap-northeast-2',
    endpoint: "http://dynamodb.ap-northeast-2.amazonaws.com"
});

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

//const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

var now;
var lowestPrices;
var statistics;

var traceProducts = [
    "컬쳐랜드",
    "해피머니 온라인상품권",
    "도서문화상품권",
    "롯데",
    "신세계",
    "머니트리",
];

var getProductId = function (item) {
    for (var i = 0; i < traceProducts.length; i++) {
        if (item.title.indexOf(traceProducts[i]) > -1) {
            return traceProducts[i];
        }
    }
    return null;
};

var getStatistics = function (item, callback) {
    var productId = getProductId(item);
    var lowPrices = {
        _lowest_item: item,
        _latest_data: {price: item.price, ts: 0},
        _007d_price: item.price,
        _030d_price: item.price,
        _365d_price: item.price,
    };

    if (!productId) {
        callback(lowPrices);
        return;
    }

    if (statistics[productId] && statistics[productId].lowPrices) {
        if (item.lowestPrice < statistics[productId].lowPrices._lowest_item.lowestPrice) {
            statistics[productId].lowPrices._lowest_item = item;
        }
        callback(statistics[productId].lowPrices);
        return;
    }

    var getParams = {
        TableName: 'webdata',
        Key: {
            site: productId,
            timestamp: 0,
        }
    };

    console.log(`Get Statistics for ${productId}`);
    docClient.get(getParams, (err, res) => {
        var data = [];
        if (!err) {
            //console.log(JSON.stringify(res));
            if (res && res.Item && res.Item.data) {
                data = res.Item.data;
            }
        }

        statistics[productId] = {};

        lowPrices = data.reduce((prev, curr) => {
            // 7일 이내 데이터이면
            if (now < curr.ts + 7 * 24 * 60 * 60) {
                if (curr.price < prev._007d_price) {
                    prev._007d_price = curr.price;
                }
            }
            // 30일 이내 데이터이면
            if (now < curr.ts + 30 * 24 * 60 * 60) {
                if (curr.price < prev._030d_price) {
                    prev._030d_price = curr.price;
                }
            }
            // 1년 이내 데이터이면
            if (now < curr.ts + 365 * 24 * 60 * 60) {
                if (curr.price < prev._365d_price) {
                    prev._365d_price = curr.price;
                }
            }

            if (prev._latest_data.ts < curr.ts) {
                prev._latest_data = curr;
            }
            return prev;
        }, lowPrices);
        statistics[productId].lowPrices = lowPrices;
        callback(lowPrices);
    });
};

var updateStatistics = function (productId, lowestPrice, callback) {
    var getParams = {
        TableName: 'webdata',
        Key: {
            site: productId,
            timestamp: 0,
        }
    };

    console.log(`Get Statistics for ${productId}`);
    docClient.get(getParams, (err, res) => {
        var data = [];
        if (!err) {
            //console.log(JSON.stringify(res));
            if (res && res.Item && res.Item.data) {
                data = res.Item.data;
            }
        }

        data.push({ ts: now, price: lowestPrice });

        var unique_data = [];

        for (var i = 0; i < data.length; i++) {
            var found = false;
            for (var j = 0; j < unique_data.length; j++) {
                if (unique_data[j].ts == data[i].ts) {
                    found = true;
                    unique_data[j].price = data[i].price;
                }
            }
            if (!found) {
                unique_data.push(data[i]);
            }
        }

        unique_data = unique_data.map((d) => {
            // 1년 이내 데이터이면
            if (now < d.ts + 365 * 24 * 60 * 60) {
                return d;
            }
        });

        var putParams = {
            TableName: 'webdata',
            Item: {
                site: productId,
                timestamp: 0,
                ttl: now + 30 * 24 * 60 * 60,
                data: unique_data
            }
        };

        console.log("Updating Statistics");
        docClient.put(putParams, (err, res) => {
            if (!err) {
                console.log(err);
            }
            console.log("Statistics updated");
            if (callback) {
                callback(null);
            }
        });
    });
};

var diffCommaNumber = function(num1, num2) {
    if (num1 > num2) {
        return `+${commaNumber(num1 - num2)}`;
    } else if (num1 < num2) {
        return `-${commaNumber(num2 - num1)}`;
    } else {
        return "0";
    }
}

var processItem = function (result, saved, item, callback) {
    var re = /([0-9]+)만원/;
    var matches = re.exec(item.title);
    var percent = 10000;
    if (matches && matches.length >= 2) {
        percent = (item.lowestPrice * 10000) / (matches[1] * 10000);
    }

    // estimation
    if (percent === 10000) {
        var money_list = [1, 2, 3, 5, 10, 20, 50];
        var curr_percent = 0;
        for (var i = 0; i < money_list.length; i++) {
            curr_percent = item.lowestPrice / money_list[i];
            if (curr_percent <= 10000) {
                percent = curr_percent;
                break;
            }
        }
    }

    if (percent >= 10000) {
        console.log(`신규 상품 확인 ${item.title} : ${item.url}, ${item.lowestPrice}`);
    } else {
        console.log(`신규 상품 확인 ${item.title} : ${item.url}, ${item.lowestPrice}, ${((10000 - percent)/100).toFixed(2)}%`);
    }

    var found = saved.items.reduce((f, curr) => {
        if (f) {
            return f;
        } else {
            if (curr.url === item.url) {
                return curr;
            }
        }
    }, null);

    getStatistics(item, (lowPrices) => {
        //console.log(lowPrices);
        if (!found) {
            console.log(`New item ${item.title}`);
            result.message += `[신규 상품 등록]\n`;
            result.message += `품명: ${item.title}\n`;
            if (percent >= 10000) {
                result.message += `가격: ${commaNumber(item.lowestPrice)}\n`;
            } else {
                result.message += `가격: ${commaNumber(item.lowestPrice)} ${((10000 - percent)/100).toFixed(2)}%\n`;
            }
            result.message += `(주: ${diffCommaNumber(item.lowestPrice, lowPrices._007d_price)} 월: ${diffCommaNumber(item.lowestPrice, lowPrices._030d_price)} 년: ${diffCommaNumber(item.lowestPrice, lowPrices._365d_price)})\n`;
            result.message += `URL: ${item.url}\n`
            result.message += `\n`;
        } else {
            console.log(`통계 최저가: ${lowPrices._latest_data.price}, 최저가 변동: ${found.lowestPrice} => ${item.lowestPrice}`);
            if (item.lowestPrice !== found.lowestPrice) {
                console.log(`New lowest price ${item.title} => ${item.lowestPrice}`);
                result.message += `[가격 변동]\n`;
                result.message += `품명: ${item.title}\n`;
                if (percent === 10000) {
                    result.message += `가격: ${commaNumber(item.lowestPrice)} (${diffCommaNumber(item.lowestPrice, found.lowestPrice)})\n`;
                } else {
                    result.message += `가격: ${commaNumber(item.lowestPrice)} ${((10000 - percent)/100).toFixed(2)}% (${diffCommaNumber(item.lowestPrice, found.lowestPrice)})\n`;
                }
                result.message += `(주: ${diffCommaNumber(item.lowestPrice, lowPrices._007d_price)} 월: ${diffCommaNumber(item.lowestPrice, lowPrices._030d_price)} 년: ${diffCommaNumber(item.lowestPrice, lowPrices._365d_price)})\n`;
                result.message += `URL: ${item.url}\n`;
                result.message += `\n`;
            }
        }
        callback(null);
    });
};

var makeReport = function (result, callback) {
    var queryParams = {
        TableName: 'webdata',
        KeyConditionExpression: "#site = :site",
        ScanIndexForward: false,
        Limit: 1,
        ExpressionAttributeNames: {
            "#site": "site"
        },
        ExpressionAttributeValues: {
            ":site": 'hotdeal-collect'
        }
    };

    result.data.items = [].concat(result.tmon, result.wemakeprice);

    result.data.items = result.data.items.filter(function(item) {
        return item.alive > 0;
    });

    console.log("Making Report");
    docClient.query(queryParams, (err, res) => {
        if (!err) {
            var saved = { items: [] };
            if (res.Items.length > 0 && res.Items[0].data) {
                saved = res.Items[0].data;
            }
            saved.items = saved.items.filter(function(item) {
                return item.alive > 0;
            });
            async.series([
                function (callback) {
                    async.eachSeries(result.data.items, (item, callback) => {
                        processItem(result, saved, item, callback);
                    }, function (err) {
                        callback(err);
                    });
                },
                function (callback) {
                    async.each(saved.items, (item, callback) => {
                        console.log(`기존 상품 확인: ${item.title} : ${item.url} ${item.lowestPrice}`);
                        var found = result.data.items.reduce((f, curr) => {
                            if (f) {
                                return f;
                            } else {
                                if (curr.url === item.url) {
                                    return curr;
                                }
                            }
                        }, null);

                        if (!found) {
                            item.alive--;
                            if (item.alive <= 0) {
                                console.log(`Soldout item ${item.title}`);
                                result.message += `[판매 중지]\n`;
                                result.message += `품명: ${item.title}\n`;
                                result.message += `가격: ${commaNumber(item.lowestPrice)}\n`;
                                result.message += `URL: ${item.url}\n`;
                                result.message += `\n`;
                            } else {
                                result.data.items.push(item);
                            }
                        }
                        callback(null);
                    }, function (err) {
                        callback(err);
                    });
                },
            ], function (err) {
                if (!err) {
                    for (var productId in statistics) {
                        if (statistics[productId].lowPrices._lowest_item.lowestPrice !== statistics[productId].lowPrices._latest_data.price) {
                            console.log(`Update statistics ${productId} ${statistics[productId].lowPrices._latest_data.price} => ${statistics[productId].lowPrices._lowest_item.lowestPrice}`);
                            updateStatistics(productId, statistics[productId].lowPrices._lowest_item.lowestPrice);
                        }
                    }
                }
                callback(err, result);
            });
        } else {
            callback(err, result);
        }
    });
};

var saveReport = function (result, callback) {
    var putParams = {
        TableName: 'webdata',
        Item: {
            site: 'hotdeal-collect',
            timestamp: now,
            ttl: now + 30 * 24 * 60 * 60,
            data: result.data
        }
    };

    console.log("Saving Report");
    docClient.put(putParams, (err, res) => {
        if (!err) {
            console.log(JSON.stringify(res));
        }
        callback(err, result);
    });
};

var notifyReport = function (result, callback) {
    console.log("Notify Report");
    if (result.message.length > 0) {
        var telegramConfig = config.get('telegram');
        var option = {
            uri: `https://api.telegram.org/${telegramConfig.bot_id}:${telegramConfig.token}/sendMessage`,
            method: 'POST',
            json: true,
            body: {
                'chat_id': telegramConfig.chat_id,
                'text': result.message
            }
        };

        req(option, function (err, response, body) {
            if (!err && (body && !body.ok)) {
                console.log(body);
                callback("Send Message Fail", result);
            } else {
                callback(err, result);
            }
        });
    } else {
        callback(null, result);
    }
};

exports.handler = function (event, context, callback) {
    now = Math.floor(Date.now() / 1000);

    lowestPrices = {};
    statistics = {};

    async.waterfall([
        function(callback) {
            callback(null, {
                wemakeprice: [],
                tmon: [],
                data: {
                    items: [],
                },
                message: "",
            });
        },
        wemakeprice_giftcard.process,
        tmon_giftcard.process,
        makeReport,
        saveReport,
        notifyReport,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
    });

    if (callback) {
        callback(null);
    }
};
