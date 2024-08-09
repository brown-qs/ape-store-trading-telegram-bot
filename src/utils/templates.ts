import BigNumber from "bignumber.js";
import { PrismaClient } from "@prisma/client";
import { Config } from "../config/constrants";
import { getBalance, batchCheckERC20Balance } from "./fetch";
import Web3 from "web3";
import { insertItem } from "../types";
import dayjs from "dayjs";

const prisma = new PrismaClient();

export const formatUSDPrice = (price: number) => {
  if (price >= 0 && price < 1000) {
    return BigNumber(price).toFixed();
  } else if (price >= 1000 && price < 1000000) {
    return BigNumber(Number((price / 1000).toFixed(3))).toFixed() + "K";
  } else if (price >= 1000000 && price < 1000000000) {
    return BigNumber(Number((price / 1000000).toFixed(3))).toFixed() + "M";
  } else if (price >= 1000000000) {
    return BigNumber(Number((price / 1000000000).toFixed(3))).toFixed() + "B";
  }
};
export const getTypeName = (type: number) => {
  switch (type) {
    case 1:
      return "Manually";
    case 2:
      return "Manually sell";
    case 3:
      return "Follow a single buy";
    case 4:
      return "Selling";
    case 5:
      return "Grabbing";
    case 6:
      return "MEV";
    case 7:
      return "Vending";
  }
};
export const dexNames = {
  1: {
    uniswapv3: "uniswap V3",
    uniswapv2: "uniswap V2",
  },
  5: {
    uniswapv3: "uniswap V3",
    uniswapv2: "uniswap V2",
  },
  42161: {
    uniswapv3: "uniswap V3",
    uniswapv2: "sushiswap",
    camelotv2: "camelotswap",
  },
};
export const defaultKeyboard = [
  {
    text: "↪️ Back to homepage",
    callback_data: "go_home",
  },
];
export const backToSettingKeyboard = [
  {
    text: "↪️ Back to setting",
    callback_data: "settings",
  },
];
export const chainEnum = {
  1: "Ethereum",
  42161: "Arbitrum",
  5: "Goerli",
};
export const getScan = (address: string, chainId: number) => {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/token/${address}`;
    case 42161:
      return `https://arbiscan.io/token/${address}`;
    case 5:
      return `https://goerli.etherscan.io/token/${address}`;
  }
};
export const getTxScan = (hash: string, chainId: number) => {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/tx/${hash}`;
    case 42161:
      return `https://arbiscan.io/tx/${hash}`;
    case 5:
      return `https://goerli.etherscan.io/tx/${hash}`;
  }
};
export const getDexTool = (address: string, chainId: number) => {
  switch (chainId) {
    case 1:
      return `https://dexscreener.com/ethereum/${address}`;
    case 42161:
      return `https://dexscreener.com/arbitrum/${address}`;
    case 5:
      return `https://dexscreener.com/ethereum/${address}`;
  }
};
export const editorBuySuccessTemplate = async (
  bot: any,
  contract: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number,
  log: any
) => {
  let tx = getTxScan(log.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  let receiveAddress = user.default_address;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: receiveAddress }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, log.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let perPrice = BigNumber(
    Number((Number(log.price) * wethPrice).toFixed(15))
  ).toFixed();
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Buy：${log.in_amount} ETH</b>\n` +
    `<b>💵 income：${log.out_amount} ${log.symbol}</b>\n` +
    `<b>🚨 type：${getTypeName(log.type)}</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 total expenses：$ ${log.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 Before buying price: $ ${perPrice}</b>\n` +
    `<b>💵 Price after buying: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Buy address:</b>\n` +
    `<b>${log.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 2 ${log.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 2 ${log.id}`,
      },
    ],
    [
      {
        text: `💯 Selling ratio(${user.sell_percent} %)`,
        callback_data: `/set_sell_percent 2 ${log.id} `,
      },
    ],
    [
      {
        text: `🚀 Sell`,
        callback_data: `/sell ${contract.chain_id} ${contract.address} 2 ${log.id}`,
      },
    ],
  ];
  bot.editMessageText(str, {
    chat_id: user.query.message.chat.id,
    message_id: user.query.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const editorSellSuccessTemplate = async (
  bot: any,
  contract: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number,
  log: any
) => {
  let tx = getTxScan(log.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  let receiveAddress = user.default_address;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: receiveAddress }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, log.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let perPrice = BigNumber(
    Number((Number(log.price) * wethPrice).toFixed(15))
  ).toFixed();
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Sell：${log.in_amount} ${log.symbol}</b>\n` +
    `<b>💵 income：${log.out_amount} ETH</b>\n` +
    `<b>🚨 type：${getTypeName(log.type)}</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 Total revenue：$ ${log.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 Property before selling: $ ${perPrice}</b>\n` +
    `<b>💵 Price after selling: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Sell ​​address:</b>\n` +
    `<b>${log.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 3 ${log.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 3 ${log.id}`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 3 ${log.id}`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 ${log.id}`,
      },
    ],
  ];
  bot.editMessageText(str, {
    chat_id: user.query.message.chat.id,
    message_id: user.query.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const sellSuccessTemplate = async (
  bot: any,
  msg: any,
  contract: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number,
  log: any
) => {
  let tx = getTxScan(log.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  let receiveAddress = user.default_address;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: receiveAddress }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, log.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let perPrice = BigNumber(
    Number((Number(log.price) * wethPrice).toFixed(15))
  ).toFixed();
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Sell：${log.in_amount} ${log.symbol}</b>\n` +
    `<b>💵 income：${log.out_amount} ETH</b>\n` +
    `<b>🚨 type：${getTypeName(log.type)}</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 Total revenue：$ ${log.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 Property before selling: $ ${perPrice}</b>\n` +
    `<b>💵 Price after selling: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Sell ​​address:</b>\n` +
    `<b>${log.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 3 ${log.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 3 ${log.id}`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 3 ${log.id}`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 ${log.id}`,
      },
    ],
  ];
  bot.sendMessage(msg.message.chat.id, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const buySuccessTemplate = async (
  bot: any,
  msg: any,
  contract: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number,
  log: any
) => {
  let tx = getTxScan(log.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  let receiveAddress = user.default_address;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: receiveAddress }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, log.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let perPrice = BigNumber(
    Number((Number(log.price) * wethPrice).toFixed(15))
  ).toFixed();
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Buy：${log.in_amount} ETH</b>\n` +
    `<b>💵 income：${log.out_amount} ${log.symbol}</b>\n` +
    `<b>🚨 type：${getTypeName(log.type)}</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 total expenses：$ ${log.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 Before buying price: $ ${perPrice}</b>\n` +
    `<b>💵 Price after buying: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Buy address:</b>\n` +
    `<b>${log.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 2 ${log.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 2 ${log.id}`,
      },
    ],
    [
      {
        text: `💯 Selling ratio(${user.sell_percent} %)`,
        callback_data: `/set_sell_percent 2 ${log.id}`,
      },
    ],
    [
      {
        text: `🚀 Sell`,
        callback_data: `/sell ${contract.chain_id} ${contract.address} 2 ${log.id}`,
      },
    ],
  ];
  bot.sendMessage(msg.message.chat.id, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const pendingTamplate = async (
  bot: any,
  msg: any,
  contract: any,
  amount: number,
  hash: string,
  type: number
) => {
  let tx = getTxScan(hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let amountIn = null;
  if (type == 1) {
    amountIn = `<b>💵 Buy：${BigNumber(amount).toFixed()} ETH</b>\n`;
  } else if (type == 2) {
    amountIn = `<b>💵 Sell：${BigNumber(amount).toFixed()} ${contract.symbol
      }</b>\n`;
  } else if (type == 3) {
    amountIn = `<b>💵 Follow a single buy：${BigNumber(
      amount
    ).toFixed()} ETH</b>\n`;
  } else if (type == 4) {
    amountIn = `<b>💵 Selling：${BigNumber(amount).toFixed()} ${contract.symbol
      }</b>\n`;
  } else if (type == 5) {
    amountIn = `<b>💵 Grabbing：${BigNumber(amount).toFixed()} ${contract.symbol
      }</b>\n`;
  }
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    amountIn +
    `<b>🚨 type：${getTypeName(type)}</b>\n` +
    `<b>⏳ state：pending</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n`;

  bot.sendMessage(msg.message.chat.id, str, {
    parse_mode: "HTML",
  });
};
export const errorTamplate = async (
  bot: any,
  msg: any,
  contract: any,
  amount: number,
  hash: string,
  type: number,
  remark: string
) => {
  let a = "";
  if (hash) {
    let tx = getTxScan(hash, contract.chain_id);
    a = `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n`;
  }
  let scan = getScan(contract.address, contract.chain_id);
  let amountIn = null;
  if (type == 1) {
    amountIn = `<b>💵 Buy：${BigNumber(amount).toFixed()} ETH</b>\n`;
  } else if (type == 2) {
    amountIn = `<b>💵 Sell：${BigNumber(amount).toFixed()} ${contract.symbol
      }</b>\n`;
  } else if (type == 3) {
    amountIn = `<b>💵 Follow a single buy：${BigNumber(
      amount
    ).toFixed()} ETH</b>\n`;
  } else if (type == 4) {
    amountIn = `<b>💵 Selling：${BigNumber(amount).toFixed()} ${contract.symbol
      }</b>\n`;
  }
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    amountIn +
    `<b>🚨 type：${getTypeName(type)}</b>\n` +
    `<b>⏳ state：fail</b>\n` +
    `<b>📄 reason：${remark}</b>\n` +
    a;

  bot.sendMessage(msg.message.chat.id, str, {
    parse_mode: "HTML",
  });
};
export const editorContractTemplate = async (
  bot: any,
  contract: any,
  user: any,
  currentGasPrice: string,
  wethPrice: number
) => {
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  if (user.default_address) {
    let receiveAddress = user.default_address;
    let coinBalance = await batchCheckERC20Balance(
      [{ contractAddr: contract.address, owner: receiveAddress }],
      contract.chain_id
    );
    let ethBalance = await getBalance(contract.chain_id, user.default_address);
    if (coinBalance.length) {
      userCoinBalance = Number(
        (
          Number(coinBalance[0].balance) /
          10 ** Number(coinBalance[0].decimals)
        ).toFixed(4)
      );
    }
    userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  }
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let dex = getDexTool(contract.address, contract.chain_id);
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 default address:</b>\n` +
    `<b>${user.default_address
      ? user.default_address
      : "There is no setting address"
    }</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const contractKeyboard = [
    [
      {
        text: `💳 (${user.default_address
          ? user.default_address.substring(
            user.default_address.length - 15,
            user.default_address.length
          )
          : "Click to select wallet"
          })`,
        callback_data: "picker_wallet",
      },
    ],
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 1 0`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 1 0`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 1 0`,
      },
    ],
    [
      {
        text: `💯 Selling ratio(${user.sell_percent} %)`,
        callback_data: `/set_sell_percent 1 0`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 0`,
      },
      {
        text: `🚀 Sell`,
        callback_data: `/sell ${contract.chain_id} ${contract.address} 2 0`,
      },
    ],
  ];
  bot.editMessageText(str, {
    chat_id: user.query.message.chat.id,
    message_id: user.query.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: contractKeyboard,
    },
  });
};
export const pickerFollowWalletTempalte = async (
  bot: any,
  msg: any,
  watchId: number
) => {
  let wallets: any = await prisma.wallet.findMany({
    where: {
      telegram_id: msg.from.id,
    },
  });

  let str = ``;
  if (wallets.length) {
    str += `<b>Please select a wallet</b>`;
  } else {
    str = "<b>Not yet binded wallet，Please bind the wallet first</b>";
  }
  let find: any = await prisma.watch.findFirst({
    where: {
      id: watchId,
      telegram_id: msg.from.id,
    },
  });

  if (find) {
    let keyboard = [];
    wallets.forEach((item, index) => {
      let showAddr =
        item.address.substring(0, 15) +
        "···" +
        item.address.substring(item.address.length - 15, item.address.length);
      keyboard.push([
        {
          text: showAddr,
          callback_data: `/set_follow_wallet ${index} ${watchId}`,
        },
      ]);
    });
    if (!wallets.length) {
      keyboard.push([
        {
          text: "💳 Add wallet",
          callback_data: "go_home",
        },
      ]);
    }
    keyboard.push([
      {
        text: "↪️ return",
        callback_data: `/handle_watch ${find.address}`,
      },
    ]);
    bot.editMessageText(str, {
      chat_id: msg.message.chat.id,
      message_id: msg.message.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  }
};
export const pickerTaskWalletTempalte = async (
  bot: any,
  msg: any,
  task: any
) => {
  let wallets: any = await prisma.wallet.findMany({
    where: {
      telegram_id: msg.from.id,
    },
  });
  let str = ``;
  if (wallets.length) {
    str += `<b>Please select a wallet</b>`;
  } else {
    str = "<b>Not yet binded wallet，Please bind the wallet first</b>";
  }
  let keyboard = [];
  wallets.forEach((item, index) => {
    let showAddr =
      item.address.substring(0, 15) +
      "···" +
      item.address.substring(item.address.length - 15, item.address.length);
    keyboard.push([
      {
        text: showAddr,
        callback_data: `/set_task_wallet ${index} ${task.id}`,
      },
    ]);
  });
  if (!wallets.length) {
    keyboard.push([
      {
        text: "💳 Add wallet",
        callback_data: "go_home",
      },
    ]);
  }
  bot.editMessageText(str, {
    chat_id: msg.message.chat.id,
    message_id: msg.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
};
export const pickerWalletTempalte = async (bot: any, msg: any) => {
  let wallets: any = await prisma.wallet.findMany({
    where: {
      telegram_id: msg.from.id,
    },
  });
  let str = ``;
  if (wallets.length) {
    str += `<b>Please select a wallet</b>`;
  } else {
    str = "<b>Not yet binded wallet，Please bind the wallet first</b>";
  }
  let keyboard = [];
  let contractAddress = msg.message.text.split("\n")[3];
  wallets.forEach((item, index) => {
    let showAddr =
      item.address.substring(0, 15) +
      "···" +
      item.address.substring(item.address.length - 15, item.address.length);
    keyboard.push([
      {
        text: showAddr,
        callback_data: `/set_default_wallet ${index} ${contractAddress}`,
      },
    ]);
  });
  if (!wallets.length) {
    keyboard.push([
      {
        text: "💳 Add wallet",
        callback_data: "go_home",
      },
    ]);
  }
  bot.editMessageText(str, {
    chat_id: msg.message.chat.id,
    message_id: msg.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
};
export const createContractTemplate = async (
  bot: any,
  currentGasPrice: number,
  wethPrice: number,
  chatId: number,
  contract: insertItem
) => {
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let pools = JSON.parse(contract.liquidity_pools);
  let scan = getScan(contract.address, contract.chain_id);
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let price = BigNumber(
    (Number(pools[0][contract.symbol]) * wethPrice).toFixed(15)
  ).toFixed();
  let firstPrice = BigNumber(
    (Number(contract.first_price) * wethPrice).toFixed(15)
  ).toFixed();
  pools.forEach((item) => {
    poolEthBalance +=
      item.pool.token0 == Config[contract.chain_id].stableContract[0]
        ? Number(item.pool.reserve0)
        : Number(item.pool.reserve1);
    poolTokenBalance +=
      item.pool.token0 == Config[contract.chain_id].stableContract[0]
        ? Number(item.pool.reserve1)
        : Number(item.pool.reserve0);
  });
  poolPercent = Number(
    ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
  );
  let percent = 0;
  if (Number(firstPrice) > Number(price)) {
    percent = -Number(
      ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
    );
  } else {
    percent = Number(
      ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
    );
  }
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${pools[0].pool.pool}</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][pools[0].version]}</b>\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    `<b>💵 Initial price: $ ${firstPrice}</b>\n` +
    `<b>📈 Historical gain: ${percent} %</b>\n` +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n`;
  const contractKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/send_contract ${contract.address}`,
      },
    ],
  ];
  bot.sendMessage(chatId, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: contractKeyboard,
    },
  });
};
export const editorRushDetailTemplate = async (
  bot: any,
  query: any,
  contract: any,
  task: any,
  currentGasPrice: string,
  wethPrice: number
) => {
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  if (task.private_key) {
    let receiveAddress = task.address;
    let coinBalance = await batchCheckERC20Balance(
      [{ contractAddr: contract.address, owner: receiveAddress }],
      contract.chain_id
    );
    let ethBalance = await getBalance(contract.chain_id, receiveAddress);
    if (coinBalance.length) {
      userCoinBalance = Number(
        (
          Number(coinBalance[0].balance) /
          10 ** Number(coinBalance[0].decimals)
        ).toFixed(4)
      );
    }
    userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 default address:</b>\n` +
    `<b>${task.address ? task.address : "There is no setting address"}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  let startTime = dayjs(task.start_time * 1000).format("YYYY-MM-DD HH:mm:ss");
  const contractKeyboard = [
    [
      {
        text: `💳 (${task.address
          ? task.address.substring(
            task.address.length - 15,
            task.address.length
          )
          : "Click to select wallet"
          })`,
        callback_data: `/picker_task_wallet ${task.id}`,
      },
    ],
    [
      {
        text: `⛽ (${task.gas_fee} Gwei)`,
        callback_data: `/set_task_gas_fee  ${task.id}`,
      },
      {
        text: `💰 Purchase amount(${task.amount} ETH)`,
        callback_data: `/set_task_buy_amount  ${task.id}`,
      },
    ],
    [
      {
        text: `⏰ time(${startTime})`,
        callback_data: `/set_task_start_time  ${task.id}`,
      },
    ],
    [
      {
        text: "❌ Delete task",
        callback_data: `/delete_task ${task.id}`,
      },
    ],
    defaultKeyboard,
  ];
  bot.editMessageText(str, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: contractKeyboard,
    },
  });
};
export const rushDetailTemplate = async (
  bot: any,
  chatId: number,
  contract: any,
  task: any,
  currentGasPrice: string,
  wethPrice: number
) => {
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  if (task.private_key) {
    let receiveAddress = task.address;
    let coinBalance = await batchCheckERC20Balance(
      [{ contractAddr: contract.address, owner: receiveAddress }],
      contract.chain_id
    );
    let ethBalance = await getBalance(contract.chain_id, receiveAddress);
    if (coinBalance.length) {
      userCoinBalance = Number(
        (
          Number(coinBalance[0].balance) /
          10 ** Number(coinBalance[0].decimals)
        ).toFixed(4)
      );
    }
    userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 default address:</b>\n` +
    `<b>${task.address ? task.address : "There is no setting address"}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  let startTime = dayjs(task.start_time * 1000).format("YYYY-MM-DD HH:mm:ss");
  const contractKeyboard = [
    [
      {
        text: `💳 (${task.address
          ? task.address.substring(
            task.address.length - 15,
            task.address.length
          )
          : "Click to select wallet"
          })`,
        callback_data: `/picker_task_wallet ${task.id}`,
      },
    ],
    [
      {
        text: `⛽ (${task.gas_fee} Gwei)`,
        callback_data: `/set_task_gas_fee ${task.id}`,
      },
      {
        text: `💰 Purchase amount(${task.amount} ETH)`,
        callback_data: `/set_task_buy_amount ${task.id}`,
      },
    ],
    [
      {
        text: `⏰ time(${startTime})`,
        callback_data: `/set_task_start_time ${task.id}`,
      },
    ],
    [
      {
        text: "❌ Delete task",
        callback_data: `/delete_task ${task.id}`,
      },
    ],
    defaultKeyboard,
  ];
  bot.sendMessage(chatId, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: contractKeyboard,
    },
  });
};
export const contractTemplate = async (
  bot: any,
  msg: any,
  contract: any,
  user: any,
  currentGasPrice: string,
  wethPrice: number
) => {
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let exchangeValue = 0;
  if (user.default_address) {
    let receiveAddress = user.default_address;
    let coinBalance = await batchCheckERC20Balance(
      [{ contractAddr: contract.address, owner: receiveAddress }],
      contract.chain_id
    );
    let ethBalance = await getBalance(contract.chain_id, user.default_address);
    if (coinBalance.length) {
      userCoinBalance = Number(
        (
          Number(coinBalance[0].balance) /
          10 ** Number(coinBalance[0].decimals)
        ).toFixed(4)
      );
    }
    userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
    exchangeValue = Number(
      (Number(contract.fastGetContractPrice.price) * userCoinBalance).toFixed(5)
    );
  }
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 default address:</b>\n` +
    `<b>${user.default_address
      ? user.default_address
      : "There is no setting address"
    }</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>💰 value: ${exchangeValue} ETH</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const contractKeyboard = [
    [
      {
        text: `💳 (${user.default_address
          ? user.default_address.substring(
            user.default_address.length - 15,
            user.default_address.length
          )
          : "Click to select wallet"
          })`,
        callback_data: "picker_wallet",
      },
    ],
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 1 0`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 1 0`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 1 0`,
      },
    ],
    [
      {
        text: `💯 Selling ratio(${user.sell_percent} %)`,
        callback_data: `/set_sell_percent 1 0`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 0`,
      },
      {
        text: `🚀 Sell`,
        callback_data: `/sell ${contract.chain_id} ${contract.address} 2 0`,
      },
    ],
  ];
  bot.sendMessage(msg.from.id, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: contractKeyboard,
    },
  });
};
export const homeTemplate = (bot: any, msg: any) => {
  return new Promise<number>(async (resolve) => {
    bot
      .sendMessage(
        msg.chat.id,
        `<b></b>\n\n\n\n<b>🎉🎉🎉 Welcome! 🎉🎉🎉</b>\n\n\n\n<b></b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: homeKeyboard,
          },
        }
      )
      .then((res) => {
        resolve(res.message_id);
      });
  });
};
export const buyModesTemplate = (bot: any, msg: any) => {
  return new Promise<number>(async (resolve) => {
    bot
      .sendMessage(
        msg.chat.id,
        `<b></b>\n\n\n\n<b>☑ Select buy mode. </b>\n\n\n\n<b></b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: buyModesKeyboard,
          },
        }
      )
      .then((res) => {
        resolve(res.message_id);
      });
  });
};
export const settingTemplate = (bot: any, msg: any) => {
  let str = `<b></b>\n\n\n\n<b>🛠 Please choose one.</b>\n\n\n\n<b></b>`;
  bot.editMessageText(str, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: "HTML",
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: settingsKeyboard,
    },
  });
};
export const classicBuySettingTemplate = (bot: any, msg: any) => {
  let str = `<b></b>\n\n\n\n<b>🛠 Please choose one.</b>\n\n\n\n<b></b>`;
  bot.editMessageText(str, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: "HTML",
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: classicBuySettingKeyboard,
    },
  });
};
export const classicRampBuySettingTemplate = (bot: any, msg: any) => {
  let str = `<b></b>\n\n<b>Here are your ramp amounts.</b>\n\n<b>1️⃣ 10</b>\n\n<b>2️⃣ 20</b>\n\n<b>3️⃣ 30</b>\n\n<b>4️⃣ 40</b>\n\n\n\n\n\n<b></b>`;
  bot.editMessageText(str, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: "HTML",
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: classicRampBuySettingKeyboard,
    },
  });
};
export const goBackHomeTemplate = (bot: any, msg: any) => {
  let str = `<b></b>\n\n\n\n<b>🎉🎉🎉 Welcome! 🎉🎉🎉</b>\n\n\n\n<b></b>`;
  bot.editMessageText(str, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: "HTML",
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: homeKeyboard,
    },
  });
};
export const networkTemplate = (bot: any, msg: any, chainIds: number[]) => {
  let netWorkKeyboard = [];
  chainIds.forEach((item) => {
    netWorkKeyboard.push({
      text: chainEnum[item],
      callback_data: chainEnum[item],
    });
  });
  bot.editMessageText(
    `🌏<b>Please select the belonging chain</b>\n\n<b>Not suitable for all custom nodes，If there is a self -built node, it can be used🫰🫰🫰</b>`,
    {
      chat_id: msg.message.chat.id,
      message_id: msg.message.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [netWorkKeyboard, [...defaultKeyboard]],
      },
    }
  );
};
export const addWalletTemplate = (bot: any, msg: any) => {
  let str =
    "❗️❗️❗️ <b>Please recognize the APEBOT，Do not send it to the scammer robot</b>\n\n<b>Please lose the way you choose to bind a wallet</b>";
  bot.editMessageText(str, {
    chat_id: msg.message.chat.id,
    message_id: msg.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: addWalletKeyboard,
    },
  });
};
export const walletTemplate = async (bot: any, msg: any) => {
  let wallets: any = await prisma.wallet.findMany({
    where: {
      telegram_id: msg.from.id,
    },
  });
  let str = ``;
  if (wallets.length) {
    str += `❗️❗️❗️ <b>Please recognize the APEBOT，Do not send it to the scammer robot</b>\n\n<b>Total binding（${wallets.length}）Wallet</b>\n\n`;
    wallets.forEach((item, index) => {
      str += `<b>(${index + 1}) ${item.address}</b>\n`;
    });
  } else {
    str =
      "❗️❗️❗️ <b>Please recognize the APEBOT，Do not send it to the scammer robot</b>\n\n<b>Not yet binded wallet，Click the new button below to add a wallet</b>\n\n";
  }
  bot.editMessageText(str, {
    chat_id: msg.message.chat.id,
    message_id: msg.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: walletKeyboard,
    },
  });
};
export const rushTemplate = async (bot: any, msg: any) => {
  let time = Math.round(new Date().getTime() / 1000) - 1800;
  let result = await prisma.task.findMany({
    where: {
      telegram_id: msg.chat.id,
      type: 5,
      start_time: {
        gte: time,
      },
    },
    include: {
      targetContract: true,
    },
  });

  let str =
    "❗️❗️❗️ <b>Dogs are risky，Investment needs to be cautious</b>\n\n";
  let listKeyboard = [];
  result.forEach((item) => {
    listKeyboard.push([
      {
        text: item.targetContract.name,
        callback_data: `/rush_detail ${item.id}`,
      },
    ]);
  });
  listKeyboard.push([
    {
      text: "💳 Add to open the market",
      callback_data: "add_rush",
    },
  ]);
  listKeyboard.push(defaultKeyboard);
  bot.editMessageText(str, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: listKeyboard,
    },
  });
};
export const handleWatchTemplate = async (
  bot: any,
  msg: any,
  address: string
) => {
  let find: any = await prisma.watch.findFirst({
    where: {
      address: address,
      telegram_id: msg.from.id,
    },
  });

  const web3 = new Web3();
  if (find) {
    let str = `👀 *Monitoring address*\n\n`;
    str += "`" + address + "`\n\n";
    str += `📑 *Remark：${find.name ? find.name : "none"}*\n`;
    str += `🚀 *Whether to buy：${find.follow_buy == 1 ? "✅" : "❌"}*\n`;
    str += `🚀 *Whether to sell：${find.follow_sell == 1 ? "✅" : "❌"}*\n`;
    str += `💰 *One -meter amount：${find.follow_amount} ETH*\n`;
    str += `⛽ *HealingGas：${find.follow_gas_fee} Gwei*\n`;
    str += `💦 *Single sliding point：${find.follow_swap_fee} %*\n`;
    let account = find.follow_private_key
      ? web3.eth.accounts.privateKeyToAccount(find.follow_private_key)
      : null;
    const followKeyboard = [
      [
        {
          text: `💳 (${account
            ? account.address.substring(
              account.address.length - 15,
              account.address.length
            )
            : "Click to select wallet"
            })`,
          callback_data: `/picker_follow_wallet ${find.id}`,
        },
      ],
      [
        {
          text: `🚀 Buy ${find.follow_buy == 1 ? "✅" : "❌"}`,
          callback_data: `/set_follow_buy 5 ${find.id}`,
        },
        {
          text: `🚀 Sell ${find.follow_sell == 1 ? "✅" : "❌"}`,
          callback_data: `/set_follow_sell 5 ${find.id}`,
        },
      ],
      [
        {
          text: `⛽ (${find.follow_gas_fee} Gwei)`,
          callback_data: `/set_follow_gas_fee 5 ${find.id}`,
        },
        {
          text: `💦 Sliding point(${find.follow_swap_fee} %)`,
          callback_data: `/set_follow_swap_fee 5 ${find.id}`,
        },
      ],
      [
        {
          text: `💰 Purchase amount(${find.follow_amount} ETH)`,
          callback_data: `/set_follow_amount 5 ${find.id}`,
        },
      ],
      [
        {
          text: `📑 Remark name`,
          callback_data: `/bind_watch_name ${address}`,
        },
        {
          text: `❌ Remove monitoring`,
          callback_data: `/delete_watch ${address}`,
        },
      ],
      [
        {
          text: "↪️ return",
          callback_data: "watch",
        },
      ],
    ];
    bot.editMessageText(str, {
      chat_id: msg.message.chat.id,
      message_id: msg.message.message_id,
      parse_mode: "markdown",
      reply_markup: {
        inline_keyboard: followKeyboard,
      },
    });
  } else {
    bot.sendMessage(msg.message.chat.id, "No monitoring address is found");
  }
};
export const watchTemplate = async (bot: any, msg: any) => {
  let watchList: any = await prisma.watch.findMany({
    where: {
      telegram_id: msg.from.id,
    },
  });
  let str = ``;
  let watchKeyboard = [];
  if (watchList.length) {
    str += `👀 *List of listening address*\n\n`;
    str += `*Co -prisoner listening(${watchList.length
      })Address，Remaining can be added(${10 - watchList.length})Address*\n\n`;
    watchList.forEach((item, index) => {
      let isFollow =
        item.follow_buy == 1 || item.follow_sell == 1 ? "（In order）\n" : "";
      str +=
        "wallet(" +
        (index + 1) +
        ")\n`" +
        item.address +
        "`\n" +
        isFollow +
        "\n";
      let text = item.name
        ? `${item.address.substring(
          item.address.length - 16,
          item.address.length
        )}(${item.name})`
        : `${item.address.substring(
          item.address.length - 16,
          item.address.length
        )}`;
      watchKeyboard.push([
        {
          text: text,
          callback_data: `/handle_watch ${item.address}`,
        },
      ]);
    });
  } else {
    str =
      "👀 *List of listening address</b>\n\n<b>No monitoring address yet，Add one below*";
  }
  watchKeyboard.push([
    {
      text: "👀 New monitoring address",
      callback_data: "add_watch",
    },
  ]);
  watchKeyboard.push([...defaultKeyboard]);
  bot.editMessageText(str, {
    chat_id: msg.message.chat.id,
    message_id: msg.message.message_id,
    parse_mode: "MARKDOWN",
    reply_markup: {
      inline_keyboard: watchKeyboard,
    },
  });
};
export const editorWatchLogBuyTemplate = async (
  bot: any,
  contract: any,
  watchLog: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number
) => {
  let tx = getTxScan(watchLog.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: watchLog.address }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, watchLog.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Buy：${watchLog.amount_in} ETH</b>\n` +
    `<b>💵 income：${watchLog.amount_out} ${contract.symbol}</b>\n` +
    `<b>🚨 type：Monitoring address</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 total expenses：$ ${watchLog.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    `<b>💦 Purchase tax: ${watchLog.swap_fee} %</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Buy address:</b>\n` +
    `<b>${watchLog.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 4 ${watchLog.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 ${watchLog.id}`,
      },
    ],
  ];
  bot.editMessageText(str, {
    chat_id: user.query.message.chat.id,
    message_id: user.query.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const editorWatchLogSellTemplate = async (
  bot: any,
  contract: any,
  watchLog: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number
) => {
  let tx = getTxScan(watchLog.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: watchLog.address }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, watchLog.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Sell：${watchLog.amount_in} ${contract.symbol}</b>\n` +
    `<b>💵 income：${watchLog.amount_out} ETH</b>\n` +
    `<b>🚨 type：Monitoring address</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 Total revenue：$ ${watchLog.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    `<b>💦 Sell ​​tax: ${watchLog.swap_fee} %</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Buy address:</b>\n` +
    `<b>${watchLog.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 4 ${watchLog.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 0`,
      },
    ],
  ];
  bot.editMessageText(str, {
    chat_id: user.query.message.chat.id,
    message_id: user.query.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const watchLogBuyTemplate = async (
  bot: any,
  contract: any,
  watchLog: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number
) => {
  let tx = getTxScan(watchLog.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: watchLog.address }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, watchLog.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Buy：${watchLog.amount_in} ETH</b>\n` +
    `<b>💵 income：${watchLog.amount_out} ${contract.symbol}</b>\n` +
    `<b>🚨 type：Monitoring address</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 total expenses：$ ${watchLog.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    `<b>💦 Purchase tax: ${watchLog.swap_fee} %</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Buy address:</b>\n` +
    `<b>${watchLog.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 4 ${watchLog.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 0`,
      },
    ],
  ];
  bot.sendMessage(watchLog.telegram_id, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const watchLogSellTemplate = async (
  bot: any,
  contract: any,
  watchLog: any,
  user: any,
  currentGasPrice: number,
  wethPrice: number
) => {
  let tx = getTxScan(watchLog.hash, contract.chain_id);
  let scan = getScan(contract.address, contract.chain_id);
  let poolEthBalance = 0;
  let poolTokenBalance = 0;
  let poolPercent = 0;
  let price = "0";
  let userCoinBalance = 0;
  let userEthBalance = 0;
  let coinBalance = await batchCheckERC20Balance(
    [{ contractAddr: contract.address, owner: watchLog.address }],
    contract.chain_id
  );
  let ethBalance = await getBalance(contract.chain_id, watchLog.address);
  if (coinBalance.length) {
    userCoinBalance = Number(
      (
        Number(coinBalance[0].balance) /
        10 ** Number(coinBalance[0].decimals)
      ).toFixed(4)
    );
  }
  userEthBalance = Number((Number(ethBalance) / 10 ** 18).toFixed(4));
  if (contract.fastGetContractPrice.pool) {
    poolEthBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve0)
        : Number(contract.fastGetContractPrice.pool.reserve1);
    poolTokenBalance =
      contract.fastGetContractPrice.pool.token0 ==
        Config[contract.chain_id].stableContract[0]
        ? Number(contract.fastGetContractPrice.pool.reserve1)
        : Number(contract.fastGetContractPrice.pool.reserve0);
    poolPercent = Number(
      ((poolTokenBalance / Number(contract.total_supply)) * 100).toFixed(3)
    );
    price = BigNumber(
      (Number(contract.fastGetContractPrice.price) * Number(wethPrice)).toFixed(
        15
      )
    ).toFixed();
  }
  let firstPriceDom = "";
  if (Number(contract.first_price) > 0 && Number(price) > 0) {
    let firstPrice = BigNumber(
      (Number(contract.first_price) * wethPrice).toFixed(15)
    ).toFixed();
    let percent = 0;
    if (Number(firstPrice) > Number(price)) {
      percent = -Number(
        ((1 - Number(price) / Number(firstPrice)) * 100).toFixed(2)
      );
    } else {
      percent = Number(
        ((Number(price) / Number(firstPrice) - 1) * 100).toFixed(2)
      );
    }
    firstPriceDom += `<b>💵 Initial price: $ ${firstPrice}</b>\n`;
    firstPriceDom += `<b>📈 Historical gain: ${percent} %</b>\n`;
  }
  let swapFeeDom = "";
  if (contract.is_get_swap_fee == 1) {
    swapFeeDom += `<b>💦 Purchase tax: ${contract.buy_fee} %</b>\n`;
    swapFeeDom += `<b>💦 Sell ​​tax: ${contract.sell_fee} %</b>\n`;
  }
  let total = Number(contract.total_supply) / 10 ** Number(contract.decimals);
  let dex = getDexTool(contract.address, contract.chain_id);
  let str =
    `🎰 <b>${contract.name}(<a href='${scan}'>$${contract.symbol}</a>) # ${chainEnum[contract.chain_id]
    }</b>\n\n` +
    `<b>🏫 Contract address:</b>\n` +
    `<b>${contract.address}</b>\n` +
    `<b>🏤 Pool address:</b>\n` +
    `<b>${contract.fastGetContractPrice.pool
      ? contract.fastGetContractPrice.pool.pool
      : "No pool"
    }</b>\n\n` +
    `<b>🛒 DEX: ${dexNames[contract.chain_id][contract.fastGetContractPrice.pool.version]
    }</b>\n` +
    `<b>💵 Sell：${watchLog.amount_in} ${contract.symbol}</b>\n` +
    `<b>💵 income：${watchLog.amount_out} ETH</b>\n` +
    `<b>🚨 type：Monitoring address</b>\n` +
    `<b>⏳ state：success</b>\n` +
    `<b>💰 Total revenue：$ ${watchLog.cost}</b>\n` +
    `<b>🔎 Transaction Details：<a href='${tx}'>Click to view</a></b>\n\n` +
    `<b>⛽ GasPrice: ${currentGasPrice} Gwei</b>\n` +
    `<b>💵 price: $ ${price}</b>\n` +
    `<b>💦 Sell ​​tax: ${watchLog.swap_fee} %</b>\n` +
    firstPriceDom +
    swapFeeDom +
    `<b>📺 Chi Zizi proportion: ${poolPercent} %</b>\n` +
    `<b>🎀 pondETH: ${Number(
      (poolEthBalance / 10 ** 18).toFixed(5)
    )} ETH</b>\n` +
    `<b>💎 pond${contract.symbol}: ${Number(
      (poolTokenBalance / 10 ** Number(contract.decimals)).toFixed(5)
    )} ${contract.symbol}</b>\n` +
    `<b>💰 Market value: $ ${formatUSDPrice(
      Number((total * Number(price)).toFixed(3))
    )}</b>\n\n` +
    `<b>📌 Buy address:</b>\n` +
    `<b>${watchLog.address}</b>\n` +
    `<b>🎉 Account${contract.symbol}: ${userCoinBalance} ${contract.symbol}</b>\n` +
    `<b>📫 AccountETH: ${userEthBalance} ETH</b>\n`;
  const buyKeyboard = [
    [
      {
        text: `📈 Kline graph`,
        url: dex,
      },
    ],
    [
      {
        text: `⛽ (${user.manual_gas_fee} Gwei)`,
        callback_data: `/set_gas_fee 4 ${watchLog.id}`,
      },
      {
        text: `💦 Sliding point(${user.manual_swap_fee} %)`,
        callback_data: `/set_swap_fee 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `💰 Purchase amount(${user.amount} ETH)`,
        callback_data: `/set_buy_amount 4 ${watchLog.id}`,
      },
    ],
    [
      {
        text: `🚀 Buy`,
        callback_data: `/buy ${contract.chain_id} ${contract.address} 1 0`,
      },
    ],
  ];
  bot.sendMessage(watchLog.telegram_id, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const topFiveMinutesTemplate = async (
  bot: any,
  chatId: number,
  list: any[]
) => {
  let str = "";
  let buyKeyboard = [];
  list.forEach((item) => {
    let scan = getScan(item.address, item.chainId);
    str +=
      `🎰 <b>(<a href='${scan}'>$${item.symbol}</a>) # ${chainEnum[item.chainId]
      }</b>\n` +
      `🔁 <b>Number of transactions：${item.count} (${item.countPercent} %)</b>\n` +
      `👬 <b>Holder：${item.currentHolders} (${item.holdersPercent} %)</b>\n` +
      `💡 <b>Smart money：${item.smartMoney}</b>\n` +
      `💵 <b>price：$ ${item.currentPrice} (${item.pricePercent} %)</b>\n` +
      `💵 <b>Historical gain：${item.historyPercent} %</b>\n` +
      `💧 <b>forward20Hold a position：${item.topHolderPercent} %</b>\n` +
      `💰 <b>Net inflow of funds：${item.allInflow} ETH</b>\n\n`;
    buyKeyboard.push([
      {
        text: `🚀 Buy${item.symbol}`,
        callback_data: `/send_contract ${item.address}`,
      },
    ]);
  });
  bot.sendMessage(chatId, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const topFifteenMinutesTemplate = async (
  bot: any,
  chatId: number,
  list: any[]
) => {
  let str = "";
  let buyKeyboard = [];
  list.forEach((item) => {
    let scan = getScan(item.address, item.chainId);
    str +=
      `🎰 <b>(<a href='${scan}'>$${item.symbol}</a>) # ${chainEnum[item.chainId]
      }</b>\n` +
      `🔁 <b>Number of transactions：${item.count} (${item.countPercent} %)</b>\n` +
      `👬 <b>30The highest holder in minutes：${item.hightHolders}</b>\n` +
      `👬 <b>Holder：${item.currentHolders} (${item.holdersPercent} %)</b>\n` +
      `💡 <b>Smart money：${item.smartMoney}</b>\n` +
      `💵 <b>30The highest price in minutes：$ ${item.hightPrice}</b>\n` +
      `💵 <b>price：$ ${item.currentPrice} (${item.pricePercent} %)</b>\n` +
      `💵 <b>Historical gain：${item.historyPercent} %</b>\n` +
      `💧 <b>forward20Hold a position：${item.topHolderPercent} %</b>\n` +
      `💰 <b>Net inflow of funds：${item.allInflow} ETH</b>\n\n`;
    buyKeyboard.push([
      {
        text: `🚀 Buy${item.symbol}`,
        callback_data: `/send_contract ${item.address}`,
      },
    ]);
  });
  bot.sendMessage(chatId, str, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: buyKeyboard,
    },
  });
};
export const settingKeyboard = [
  [
    {
      text: "Sliding point",
      callback_data: "swap_fee",
    },
    {
      text: "gastip",
      callback_data: "gas_fee",
    },
    {
      text: "gastip",
      callback_data: "gas_fee",
    },
  ],
];
export const addWalletKeyboard = [
  [
    {
      text: "➡️ Import wallet",
      callback_data: "import_wallet",
    },
  ],
  [
    {
      text: "⬅️ Generate wallet",
      callback_data: "generate_wallet",
    },
  ],
  [...defaultKeyboard],
];
export const walletKeyboard = [
  [
    {
      text: "💳 New Wallet",
      callback_data: "add_wallet",
    },
    {
      text: "❌ Delete Wallet",
      callback_data: "delete_wallet",
    },
  ],
  [
    {
      text: "🗝 Export Private Key",
      callback_data: "export_wallet",
    },
    {
      text: "👬 Withdraw Wallet",
      callback_data: "withdraw_wallet",
    },
  ],
  [...defaultKeyboard],
];
export const homeKeyboard = [
  [
    {
      text: "🧮 Buy Modes",
      callback_data: "buy_modes",
    },
    {
      text: "💰 Assets",
      callback_data: "assets",
    },
    {
      text: "🔍 CopyTrading",
      callback_data: "copytrading",
    },
  ],
  [
    {
      text: "💳 wallet",
      callback_data: "wallet",
    },
    {
      text: "⚙ Settings",
      callback_data: "settings",
    },
  ],
];
export const buyModesKeyboard = [
  [
    {
      text: "🚗 Classic Buy",
      callback_data: "add_rush",  // classic_buy
    },
    {
      text: "🏍 Auto Buy",
      callback_data: "auto_buy",
    },
    {
      text: "🚌 Bundle Buy",
      callback_data: "bundle_buy",
    },
  ],
  defaultKeyboard
];
export const settingsKeyboard = [
  [
    {
      text: "🚗 Classic Buy",
      callback_data: "classic_buy_setting",
    },
    {
      text: "🏍 Auto Buy",
      callback_data: "auto_buy_setting",
    },
  ],
  [
    {
      text: "🚌 Bundle Buy",
      callback_data: "bundle_buy_setting",
    },
    {
      text: "🔍 CopyTrading",
      callback_data: "copy_trading_setting",
    },
  ],
  defaultKeyboard
];
export const classicBuySettingKeyboard = [
  [
    {
      text: "🎡 Quick Buy",
      callback_data: "quick_buy_setting",
    },
    {
      text: "🎨 Ramp Buy",
      callback_data: "ramp_buy_setting",
    },
  ],
  [
    {
      text: "💠 % Take Profit",
      callback_data: "set_take_profit",
    },
    {
      text: "🌐 Marketcap Type Profit",
      callback_data: "marketcap_type_profit_setting",
    },
  ],
  [
    {
      text: "🕵️‍♂️ Dev Sell Setting",
      callback_data: "dev_sell_setting",
    },
  ],
  backToSettingKeyboard
];
export const classicRampBuySettingKeyboard = [
  [
    {
      text: "1️⃣ Update amount",
      callback_data: "update_ramp_amount_1",
    },
  ],
  [
    {
      text: "2️⃣ Update amount",
      callback_data: "update_ramp_amount_2",
    },
  ],
  [
    {
      text: "3️⃣ Update amount",
      callback_data: "update_ramp_amount_3",
    },
  ],
  [
    {
      text: "4️⃣ Update amount",
      callback_data: "update_ramp_amount_4",
    },
  ],

  backToSettingKeyboard
];
