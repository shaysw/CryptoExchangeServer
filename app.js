const express = require("express");
const https = require('https');
const fs = require('fs')

const app = express();
const API_KEY_FILE_NAME = "api_key"

let api_key, total_portfolio_value, btc_ratio, eth_ratio, btc_rate, eth_rate, btc_amount, eth_amount;

function readApiKeyFromFile(){
    return new Promise((resolve, reject) => {
      fs.readFile(API_KEY_FILE_NAME, (err, data) => {
        if (err) {
          reject (err)  // calling `reject` will cause the promise to fail with or without the error passed as an argument
          return        // and we don't want to go any further
        }
        resolve(data.toString());
      })
    })
}

function updateRate(crypto_currency_code, on_rate_update){
  var options = {
    "method": "GET",
    "hostname": "rest.coinapi.io",
    "path": `/v1/exchangerate/${crypto_currency_code}/USD`,
    "headers": {'X-CoinAPI-Key': api_key}
  };

  var request = https.request(options, function (response) {
    var chunks = [];

    response.on("data", function (chunk) {
      chunks.push(chunk);
    });

    response.on("end", function (chunk) {
      on_rate_update(JSON.parse(chunks));
    });
  });

  request.end();
}

function getResponse(){
  const options = {
    hostname: 'encrypted.google.com',
    port: 443,
    path: '/',
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);

    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });
  req.end();
}

function getPortfolioValues()
{
  return {
    "total_portfolio_value" : total_portfolio_value,
    "btc_ratio" : btc_ratio,
    "eth_ratio" : eth_ratio,
    "btc_amount" : btc_amount,
    "eth_amount" : eth_amount,
  };
}

function validateInitValues(body){
  total_portfolio_value = body.total_portfolio_value;
  btc_ratio = body.btc_ratio;
  eth_ratio = body.eth_ratio;

  if (total_portfolio_value <= 0) {
    throw new Error("portfolio value must be greater than 0");
  }
  if (btc_ratio <= 0 || eth_ratio <= 0 || btc_ratio + eth_ratio !== 1.0) {
    throw new Error("BTC/ETH ratios must be greater than 0 and amount to 1.0");
  }
}

function balancePortfolio(){
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

app.use(express.json());

app.get("/status", (req, res) => {
  res.json(getPortfolioValues());
})

app.post("/balance", (res, req) => {
  balancePortfolio();
  setTimeout(res.json(getPortfolioValues()), 0);
})

app.post("/init", (req, res) => {
  try{
    validateInitValues(req.body);
    readApiKeyFromFile().then(
        function(data) {
          api_key = data;
          balancePortfolio().then(
              function whenOk(response) {
                res.json(response)
              }).catch(function notOk(err) {
            console.log(err);
          })
        })
  }

  catch (e) {
    console.error(e);
    res.statusCode = 400;
    res.end(e.message);
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});