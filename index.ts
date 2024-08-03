import { swapBot } from "./src/bot";

new swapBot({
  token: "7291988321:AAGwMxShg4r21gPP9vdRY4OU5a_vizSJutc",
  adminName: "ape_store_trading_dev_bot",
  chainIds: [1],
  dbData: {
    host: "127.0.0.1",
    user: "js",
    password: "12345678",
    port: 3306,
    database: "ape-store-trading-dev",
  }
})
