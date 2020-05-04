const fs = require('fs')
const KrakenClient = require('kraken-api');
let key;
let secret;
let kraken;
const API_KEY_FILE_NAME = "kraken_api_key"

module.exports = {
    ETH_SYMBOL: 'XETH', BTC_SYMBOL: 'XXBT',

    readApiKeyFromFile(){
        return new Promise((resolve, reject) => {
            if (key === undefined || secret === undefined){
                fs.readFile(API_KEY_FILE_NAME, (err, data) => {
                    if (err) {
                        reject (err)
                        return
                    }
                    key = data.toString().split(',')[0];
                    secret = data.toString().split(',')[1];
                    kraken = new KrakenClient(key, secret);
                    resolve("success");
                })
            }
            else{
                resolve("keys already fetched");
            }
        })
    },

    getBalance : async function (){
        // Display user's balance
        var balance = await kraken.api('Balance');
        console.log(balance);
        return balance;
    },
    getAssets : async function (){
        // Display user's balance
        var balance = await kraken.api('Assets');
        console.log(balance);
        return balance;
    },

    buyEthSellBtc : async function (eth_amount_to_buy_or_sell){
        var buyOrSellString = eth_amount_to_buy_or_sell > 0 ? "buy" : "sell";
        var amount = Math.abs(eth_amount_to_buy_or_sell);

        var res = await kraken.api('AddOrder',
            {
                pair : this.ETH_SYMBOL + this.BTC_SYMBOL,
                type: buyOrSellString,
                ordertype: 'market',
                volume: amount
            });
        console.log(res);
        return res;
    }
}
