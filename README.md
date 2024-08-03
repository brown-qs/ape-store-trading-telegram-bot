# DAN DAO Telegram Bot

based on uniswap Telegraph robot，support eth，arb，goerli

## use npm

```bash
npm install dandao

```

## Import mysql

Please download first[mysql document](https://github.com/dandao2022/swapbot/blob/main/src/db/dandao.sql)，Be introduced。

## use DANDAO

```bash
	import {swapBot} from "dandao"

new swapBot({
    token: "telegraphtoken",
    adminName: "Telegramusername",
    chainIds: [1],
    dbData: {
        host: "127.0.0.1",
        user: "dandao",
        password: "12345678",
        port: 3306,
        database: "dandao"
    }
})

```

[Click to view API](https://github.com/dandao2022/swapbot/wiki/API)Only list a few more commonly used api，You can check more calls in the code。

## instruction

```bash
/menu front page

/bindTopChannel 5minutetopProject push

/bindChannel Singapore Chi Zi project push

```

## front page

![](https://github.com/dandao2022/swapbot/blob/main/src/assets/5.png?raw=true)

## top Push

![](https://github.com/dandao2022/swapbot/blob/main/src/assets/2.png?raw=true)

## Xinchi Push

![](https://github.com/dandao2022/swapbot/blob/main/src/assets/4.png?raw=true)

## Contract search

![](https://github.com/dandao2022/swapbot/blob/main/src/assets/3.png?raw=true)
