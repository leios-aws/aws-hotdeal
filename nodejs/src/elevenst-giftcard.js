const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;
var max_alive = 2;
var traceProducts = [
    "컬쳐랜드",
    "해피머니 온라인상품권",
    "도서문화상품권",
    "롯데",
    "신세계",
    "머니트리",
];

var ignoreProducts = [
    "정관장",
    "아이템매니아",
    "예스24",
    "엔터식스",
    "대한문고 교환권",
    "CGV기프트카드",
    "(롯데마트)",
    "(하이마트)",
    "아프리카",
];

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

var requestListPage = function (result, callback) {
    var option = {
        uri: 'https://shop.11st.co.kr/storesAjax/StoreListingAjaxAction.tmall?method=StoreSearchListingAjax',
        method: 'POST',
        json: true,
        formData: {
            searchKwd: '%ED%95%B4%ED%94%BC%EB%A8%B8%EB%8B%88',
            storeId: '330687',
            storeNo: '330687',
            encSellerNo: 'qg9Y3Xx2blZlbGkU6r7rPg==',
            pageTypeCd: '02',
            sortCd: 'NP',
            trTypeCd: 'STP06',
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        //console.log(body.totalCount);
        //console.log(body.template);

        if (!err && body.totalCount && body.totalCount > 0 && body.data && body.data.productList) {
            for (var i = 0; i < body.data.productList.length; i++) {
                var item = {};
                item.url = body.data.productList[i].prdDtlUrl;
                item.price = body.data.productList[i].selPrice;
                item.lowestPrice = body.data.productList[i].finalDscPrice;
                item.title = body.data.productList[i].prdNm;

                result.data.items.push(item);
            }
        }
        console.log(result.data);

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
            });
        },
        requestListPage,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.elevenst = result.data.items;
            callback(err, main_result);
        }
    });
};
