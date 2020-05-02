const express = require("express");
const https = require('https');
const fs = require('fs')
const tolerance = 1E-3;

const app = express();
const API_KEY_FILE_NAME = "api_key"

let api_key, total_portfolio_value, btc_ratio, eth_ratio, btc_rate, eth_rate, btc_amount, eth_amount;

function readApiKeyFromFile(){
    return new Promise((resolve, reject) => {
      if (api_key === undefined){
        fs.readFile(API_KEY_FILE_NAME, (err, data) => {
          if (err) {
            reject (err)  // calling `reject` will cause the promise to fail with or without the error passed as an argument
            return        // and we don't want to go any further
          }
          resolve(data.toString());
        })
      }
      else{
        resolve(api_key);
      }
    })
}

function updateRate(crypto_currency_code, on_rate_update){
  let options = {
    "method": "GET",
    "hostname": "rest.coinapi.io",
    "path": `/v1/exchangerate/${crypto_currency_code}/USD`,
    "headers": {'X-CoinAPI-Key': api_key}
  };

  let request = https.request(options, function (response) {
    let chunks = [];

    response.on("data", function (chunk) {
      chunks.push(chunk);
    });

    response.on("end", function (chunk) {
      on_rate_update(JSON.parse(chunks));
    });

    response.on("error", function (e) {
      throw new Error(e.message);
    });
  });

  request.end();
}

function getActualPortfolioValue() {
    return getBtcValue() + getEthValue();
}
function getBtcValue() {
    return btc_amount * btc_rate;
}
function getEthValue() {
    return eth_amount * eth_rate;
}

function getPortfolioValues()
{
  return {
    "total_portfolio_value" : total_portfolio_value,
    "actual_portfolio_value" : getActualPortfolioValue(),
    "btc_ratio" : btc_ratio,
    "eth_ratio" : eth_ratio,
    "btc_amount" : btc_amount,
    "eth_amount" : eth_amount,
  };
}

function validateValues(body){
  if (body.total_portfolio_value <= 0) {
    throw new Error("portfolio value must be greater than 0");
  }
  if (body.btc_ratio <= 0 || body.eth_ratio <= 0 || body.btc_ratio + body.eth_ratio !== 1.0) {
    throw new Error("BTC/ETH ratios must be greater than 0 and amount to 1.0");
  }

  total_portfolio_value = body.total_portfolio_value;
  btc_ratio = body.btc_ratio;
  eth_ratio = body.eth_ratio;
}

function initializePortfolio(){
  return new Promise((resolve, reject) => {
    updateRate("BTC", (btc_json) => {
      btc_rate = btc_json.rate;
      btc_amount = total_portfolio_value * btc_ratio / btc_rate;

      updateRate("ETH", (eth_json) => {
        eth_rate = eth_json.rate;
        eth_amount = total_portfolio_value * eth_ratio / eth_rate;
        resolve(getPortfolioValues());
      });
    });
  })
}

function validateRatios(){
  var currentBtcRatio = getBtcValue() / getActualPortfolioValue();
  var currentEthRatio = getEthValue() / getActualPortfolioValue();

  if (Math.abs(currentBtcRatio - btc_ratio) > tolerance ||
      Math.abs(currentEthRatio - eth_ratio) > tolerance){
    throw new Error(`Expected ratios to be - BTC : ${btc_ratio} ETH : ${eth_ratio}, 
      instead got - BTC : ${currentBtcRatio} ETH : ${currentEthRatio}`)
  }
}

function balancePortfolio(){
  return new Promise((resolve, reject) => {
    updateRate("BTC", (btc_json) => {
      btc_rate = btc_json.rate;

      updateRate("ETH", (eth_json) => {
        eth_rate = eth_json.rate;

        let btc_to_buy = getActualPortfolioValue() * btc_ratio / btc_rate - btc_amount; // - new_btc_ratio * btc_rate; //btc_amount * (btc_ratio - new_btc_ratio);
        let eth_to_buy = -btc_to_buy * (btc_rate / eth_rate);

        btc_amount += btc_to_buy;
        eth_amount += eth_to_buy;

        validateRatios();

        let result = getPortfolioValues();
        result['action'] = `converted ${btc_to_buy} BTC to ${eth_to_buy} ETH`;

        resolve(result);
      });
    });
  })
}

app.use(express.json());

app.get("/status", (req, res) => {
  res.json(getPortfolioValues());
})

app.post("/balance", (req, res) => {
          balancePortfolio().then(
              function whenOk(response) {
                res.json(response)
              }).catch(function notOk(e) {
            console.error(e);
            res.statusCode = 400;
            res.end(e.message);
          })
});

app.post("/init", (req, res) => {
    validateValues(req.body);
    readApiKeyFromFile().then(
        function(data) {
          api_key = data;
          initializePortfolio().then(
              function whenOk(response) {
                res.json(response)
              }).catch(function notOk(e) {
            console.error(e);
            res.statusCode = 400;
            res.end(e.message);
          })
        })
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});