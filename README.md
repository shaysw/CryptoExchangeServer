# CryptoExchangeServer
Simple API server for balancing crypto-currencies 

2 Main API calls control the service:
POST /init
Initializes the service to maintain a specified (value) ration between ETH/BTC, the body should include the following 
(as an example, for maintaining a 50/50 ratio of ETH/BTC):
{
    "btc_ratio": 0.7,
    "eth_ratio": 0.3
}

This initializes the service, fetching ETH + BTC rates from coinapi's API, triggers a 'Balance' call to the Kraken API, 
fetching the user's balance (based on API keys), and displays a response in the form:
{
        "actual_portfolio_value": 22.353913812253516,
        "desired_btc_ratio": 0.5,
        "desired_eth_ratio": 0.5,
        "btc_amount": 0.00176379,
        "eth_amount": 0.03281789
}
Note that the above example represents a ratio of 50/50 in terms of value, and so the aim is to balance to portfolio in such a way that
the ratio is BTC:0.7, ETH:0.3, as specified in the request's body

POST /balance
This API call aims to maintain the ration specified. It involves some arithmetic done to compute the amount of ETH/BTC to buy/sell 
in order to maintain said value ratio. Once the amount of crypto-currencies to buy/sell has been determined, an 'AddOrder' API call 
is fired, with the AssetPair XETHXBTC and appropriate parameters. A response is then returned in the form of 
(note the change in BTC ETH amounts, which indeed amount to the new value ratios):
{
    "actual_portfolio_value": 22.29082792794138,
    "desired_btc_ratio": 0.7,
    "desired_eth_ratio": 0.3,
    "btc_amount": 0.00125879,
    "eth_amount": 0.05473862,
    "action": "ETH buy/sell amount : -0.021857220369007214, will result in converted to BTC amount : 0.0005014695374769517"
}
