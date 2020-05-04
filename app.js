const express = require("express");
const kraken = require("./kraken-api.js")
const https = require('https');
const fs = require('fs')
const tolerance = 1E-3;

const app = express();
const API_KEY_FILE_NAME = "api_key"

let api_key,
    desired_btc_ratio,
    desired_eth_ratio,
    btc_rate,
    eth_rate,
    btc_amount,
    eth_amount;

function readApiKeyFromFile(){
  return new Promise((resolve, reject) => {
    if (api_key === undefined){
      fs.readFile(API_KEY_FILE_NAME, (err, data) => {
        if (err) {
          reject (err)
          return
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
    "actual_portfolio_value" : getActualPortfolioValue(),
    "desired_btc_ratio" : desired_btc_ratio,
    "desired_eth_ratio" : desired_eth_ratio,
    "btc_amount" : btc_amount,
    "eth_amount" : eth_amount,
  }
}

function validateValues(body){
  if (body.btc_ratio <= 0 || body.eth_ratio <= 0 || body.btc_ratio + body.eth_ratio !== 1.0) {
    throw new Error("BTC/ETH ratios must be greater than 0 and amount to 1.0");
  }
  desired_btc_ratio = body.btc_ratio;
  desired_eth_ratio = body.eth_ratio;
}

function initializePortfolio(){
  return new Promise((resolve, reject) => {
    updateRate("BTC", (btc_json) => {
      btc_rate = btc_json.rate;

      updateRate("ETH", (eth_json) => {
        eth_rate = eth_json.rate;
        kraken.getBalance().then(function (balance) {
          const balanceFromKraken = balance['result'];
          btc_amount = parseFloat(balanceFromKraken[kraken.BTC_SYMBOL]);
          eth_amount = parseFloat(balanceFromKraken[kraken.ETH_SYMBOL]);
          console.log(btc_amount);
          console.log(eth_amount);
          resolve(getPortfolioValues());
        })
      });
    });
  })
}

function validateExpectedRatios(eth_to_buy, btc_to_buy){
  var newEthAmount = eth_amount + eth_to_buy;
  var newBtcAmount = btc_amount + btc_to_buy;

  var newEthRatio = newEthAmount * eth_rate / (newEthAmount * eth_rate + newBtcAmount * btc_rate);
  var newBtcRatio = newBtcAmount * btc_rate / (newEthAmount * eth_rate + newBtcAmount * btc_rate);

  if (Math.abs(newBtcRatio - desired_btc_ratio) > tolerance ||
      Math.abs(newEthRatio - desired_eth_ratio) > tolerance){
    throw new Error(`Expected ratios to be - BTC : ${desired_btc_ratio} ETH : ${desired_eth_ratio}, 
      instead got - BTC : ${newBtcRatio} ETH : ${newEthRatio}`)
  }
}

function balancePortfolio(){
  return new Promise((resolve, reject) => {
    updateRate("BTC", (btc_json) => {
      btc_rate = btc_json.rate;

      updateRate("ETH", (eth_json) => {
        eth_rate = eth_json.rate;

        let btc_to_buy = getActualPortfolioValue() * desired_btc_ratio / btc_rate - btc_amount; // - new_btc_ratio * btc_rate; //btc_amount * (btc_ratio - new_btc_ratio);
        let eth_to_buy = -btc_to_buy * (btc_rate / eth_rate);

        validateExpectedRatios(eth_to_buy, btc_to_buy);

        kraken.buyEthSellBtc(eth_to_buy).then(krakenResult => {
          console.log(`result of operation at Kraken : ${krakenResult}`);
          let result = getPortfolioValues();
          result['action'] = `ETH buy/sell amount : ${eth_to_buy}, will result in converted to BTC amount : ${btc_to_buy}`;
          resolve(result)
        })
      });
    });
  })
}

app.use(express.json());


app.get("/buyEthSellBtc", (req, res) => {
  kraken.buyEthSellBtc().then(function (ans) {
    res.json(ans);
  })
})


app.get("/get-balance", (req, res) => {
  kraken.getBalance().then(function (balance) {
    var balanceFromKraken = balance['result'];
    btc_amount = parseFloat(balanceFromKraken[kraken.BTC_SYMBOL]);
    eth_amount = parseFloat(balanceFromKraken[kraken.ETH_SYMBOL]);
    res.json(balance)
  })
})

app.get("/assets", (req, res) => {
  kraken.getAssets().then(function (assets) {
    res.json(assets);
  })
})

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
      }).then(() => {
    kraken.readApiKeyFromFile().then((krakenApiKeyInitResult => { console.log(`kraken API key init result : ${krakenApiKeyInitResult}`)}));
  })
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});