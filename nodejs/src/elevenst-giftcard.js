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
        uri: 'http://search.11st.co.kr/Search.tmall',
        method: 'GET',
        json: true,
        qs: {
            method: 'getSearchFilterAjax',
            kwd: '%C7%D8%C7%C7%B8%D3%B4%CF',
            searchKeyword: '%C7%D8%C7%C7%B8%D3%B4%CF',
            filterSearch: 'Y',
            pageLoadType: 'ajax',
            selectedFilterYn: 'Y',
            version: '1.2',
            sellerNos: '',
            pageNo: '1',
            encodeSearchKeyword: '해피머니',
            decSearchKeyword: '해피머니',
            fromPrice: '45000',
            toPrice: '47000',
            kwd: '%ED%95%B4%ED%94%BC%EB%A8%B8%EB%8B%88',
            pageSize: '80',
            minPrice: '45000',
            maxPrice: '47000',
            firstInputKwd: '해피머니',
            myPrdViewYN: 'Y',
            sellerCreditGradeType: '[]',
            dispCtgrNo: '117025',
            dispCtgrType: 'lCtgrNo',
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        //console.log(body.totalCount);
        //console.log(body.template);

        if (!err && body.totalCount && body.totalCount > 1 && body.template) {
            var $ = cheerio.load(body.template);
            result.data.items = $("div.list_info > p.info_tit > a").map((index, element) => {
                var item = {};
                var data = $(element).data('log-body');

                item.alive = max_alive;
                item.url = data.link_url;
                item.price = parseInt(data.last_discount_price, 10);
                item.lowestPrice = parseInt(data.last_discount_price, 10);
                item.title = data.content_name;

                if (!item.price) {
                    return null;
                }
                return item;
            }).get();
        }

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
