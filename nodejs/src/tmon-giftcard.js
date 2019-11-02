const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');

var now;

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

var requestListPage = function (result, callback) {
    var option = {
        uri: 'http://www.tmon.co.kr/api/direct/v1/categorylistapi/api/strategy/filter/68090000/deals',
        method: 'GET',
        json: true,
        qs: {
            _: Date.now(),
            platform: 'PC_WEB',
            sortType: 'POPULAR'
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        /*
        <li class="item sold_out" data-d="C70E9749F43EAAAD99D4EF6C1C6AF865" data-e="F3189C3B32D6EE8E397001F2362770DE" data-maincategoryno="68090001">                    <a href="http://www.tmon.co.kr/deal/2652722802" class="anchor" tl:area="DLDRC" tl:ord="1" target="_blank">                    <div class="border">                <div class="fig">                    <div class="thumb">                        <img src="//img2.tmon.kr/cdn3/deals/2019/11/01/2652722802/2652722802_catlist_3col_v2_b62fd_1572606891production.jpg" alt="[티몬111111] 티몬블랙딜 PAYCO 상품권 2% 할인" onerror="$(this).hide().closest('.fig').find('.sticker:first').hide()">                    </div>                                                                                                    <div class="mask sold_out">                        <div class="mask_bg"></div>                        <div class="mask_info">                                                          <span class="text">매진</span>                                                   </div>                    </div>                </div>                <div class="info">                                                            <p class="deal_list_promotion_title">PAYCO 상품권 2% 할인</p>                    <p class="title_name">[티몬111111] 티몬블랙딜 PAYCO 상품권 2% 할인</p>                                        <div class="price_area">                                                                                                                       <strong class="type">균일가</strong>                                    <span class="price">                                                                                <span class="price">                                           <span class="blind">판매가:</span>                                           <i class="num">98,000</i>원                                        </span>                                    </span>                                                                                                                                    <p class="price_desc">페이코상품권 10만원권</p>                                            </div>                    <div class="label_area">                                                                                                            <span class="label label_TIME">오늘만</span>                                                                                                                <span class="label label_CONV">바로사용</span>                                                                        </div>                                        <button type="button" class="btn_favorite"><span class="blind">찜하기</span></button>                </div>                            </div>        </a>    </li>
        */
        console.log("Parsing Item List");
        if (!err) {
            if (body && body.data && body.data.items) {
                result.data.items = body.data.items.map(function(item, index) {
                    var convert = {};
                    if (item.titleDesc) {
                        convert.title = item.titleDesc;
                    } else if (item.titleName) {
                        convert.title = item.titleName;
                    } else if (item.title) {
                        convert.title = item.title;
                    } else {
                        return false;
                    }

                    convert.price = item.priceInfo.price;
                    convert.lowestPrice = convert.price;

                    if (item.discountPrice) {
                        if (convert.lowestPrice > item.discountPrice.price) {
                            convert.lowestPrice = item.discountPrice.price;
                        }
                        if (convert.lowestPrice > item.discountPrice.tmonPrice) {
                            convert.lowestPrice = item.discountPrice.tmonPrice;
                        }
                        if (convert.lowestPrice > item.discountPrice.originalPrice) {
                            convert.lowestPrice = item.discountPrice.originalPrice;
                        }
                    }

                    convert.url = `http://www.tmon.co.kr/deal/${item.dealNo}`;

                    if (convert.price < 88000) {
                        return false;
                    }
                    if (convert.price > 201000) {
                        return false;
                    }
                    for (var i = 0; i < ignoreProducts.length; i++) {
                        if (convert.title.indexOf(ignoreProducts[i]) > -1) {
                            return false;
                        }
                    }
                    // 판매 종료
                    if (item.isClosed || item.isPause || (item.dealMax && item.dealMax.soldOut)) {
                        return false;
                    }
                    console.log(convert);
                    return convert;
                }).filter(function(item) {
                    return item;
                });
                console.log(result.data.items);
            }
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
                message: "",
            });
        },
        requestListPage,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
        if (callback) {
            main_result.tmon = result.data.items;
            callback(err, main_result);
        }
    });
};