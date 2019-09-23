const async = require('async');
const wemakeprice_giftcard = require('./src/wemakeprice-giftcard.js');

exports.handler = function (event, context, callback) {

    async.waterfall([
        wemakeprice_giftcard.process,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
    });

    if (callback) {
        callback(null);
    }
};
