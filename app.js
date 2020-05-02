const express = require("express");
const app = express();

function validateInitValues(body){
  let total_portfolio_value = body.total_portfolio_value;
  let btc_ratio = body.btc_ratio;
  let eth_ratio = body.eth_ratio;

  if (total_portfolio_value <= 0) {
    throw new Error("portfolio value must be greater than 0");
  }
  if (btc_ratio <= 0 || eth_ratio <= 0 || btc_ratio + eth_ratio !== 1.0) {
    throw new Error("BTC/ETH ratios must be greater than 0 and amount to 1.0");
  }

  return {
    "total_portfolio_value" : total_portfolio_value,
    "btc_ratio" : btc_ratio,
    "eth_ratio" : eth_ratio,
  }
}

app.use(express.json());

app.post("/init", (req, res) => {
  try{
    let init_values = validateInitValues(req.body);
    res.json(init_values);
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