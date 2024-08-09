import Bot, { Message } from "node-telegram-bot-api";
import schedule from "node-schedule";
import dayjs from "dayjs";
import Web3 from "web3";
import _ from "lodash";
import DANDAO, {
  initParams,
  getProvider,
  getGasPrice,
  addContract,
  fastGetContractPrice,
  sendSignedTransaction,
  manualSwapSell,
  Config,
  batchCheckERC20Balance,
  manualSwapBuy,
  manualParams,
  getRoutes,
  callbackEvent,
  handleWatchTransactions,
  watchLog,
  pool,
  v2Pool,
  v3Pool,
  batchAllPool,
  formatPool,
  setToken,
  getFirstPrice,
  swapEvent,
  getAllHolder,
  handleSwapEventAddress,
  getBlockNumber,
  getOtherToken,
  insertItem,
  getSmartMoney,
  telegramTask,
  telegramBatchFuckTugou,
  encodeRsuhData,
} from "./dandao";
import {
  homeTemplate,
  buyModesTemplate,
  settingTemplate,
  classicBuySettingTemplate,
  classicRampBuySettingTemplate,
  walletTemplate,
  addWalletTemplate,
  goBackHomeTemplate,
  contractTemplate,
  editorContractTemplate,
  pickerWalletTempalte,
  pendingTamplate,
  errorTamplate,
  buySuccessTemplate,
  editorBuySuccessTemplate,
  sellSuccessTemplate,
  editorSellSuccessTemplate,
  networkTemplate,
  watchTemplate,
  watchLogBuyTemplate,
  watchLogSellTemplate,
  editorWatchLogBuyTemplate,
  editorWatchLogSellTemplate,
  handleWatchTemplate,
  pickerFollowWalletTempalte,
  chainEnum,
  createContractTemplate,
  topFifteenMinutesTemplate,
  topFiveMinutesTemplate,
  rushTemplate,
  rushDetailTemplate,
  editorRushDetailTemplate,
  pickerTaskWalletTempalte,
} from "./utils/templates";
import BigNumber from "bignumber.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class swapBot {
  bot: Bot;
  isCheckingPool = false;
  isCheckingPrice = false;
  chatId: number;
  topChartId: number;
  params: initParams;
  chainIds: number[];
  sdks = new Map();
  users = new Map();
  spinner: any;
  currentGasPrices = new Map();
  rushSending = new Map();
  constructor(params: initParams) {
    this.bot = new Bot(params.token, { polling: true });
    this.params = params;
    this.chainIds = params.chainIds;
    this.initialization();
    this.listenCommand();
    this.onMessage();
    this.botQuery();
    this.bot.on("polling_error", (error) => {
      console.log(error); // => 'EFATAL'
    });
    this.analyzeData();
  }
  async initialization() {
    for (let item of this.chainIds) {
      this.sdks.set(item, new DANDAO(item, true));
      const find = await prisma.event.findFirst({
        where: {
          chain_id: item,
        },
        orderBy: {
          block_number: "desc",
        },
      });
      let blockNumber = 0;
      if (find) {
        let currentBlockNumber = await getBlockNumber(item);
        if (currentBlockNumber - find.block_number < 50) {
          blockNumber = find.block_number + 1;
        }
      }
      this.sdks.get(item).startBlockEvent(blockNumber, async (res) => {
        let web3 = getProvider(item);
        let gasPrice = Number(await getGasPrice(web3));
        this.currentGasPrices.set(
          item,
          BigNumber(Number(gasPrice / 10 ** 9).toFixed(2))
        );
        this.handleWatchAndFollow(res);
        this.handleEventCallBack(res);
        this.checkPool(item);
        this.checkFirstPrice(item);
        this.checkSwapFee(item);
      });
    }
    this.checkRushList();
  }
  isAdmin(address) {
    return this.params.admins.includes(address);
  }
  async checkRushList() {
    schedule.scheduleJob("*/2 * * * * *", async () => {
      let startTime = Math.round(new Date().getTime() / 1000);
      let entTime = Math.round(new Date().getTime() / 1000) - 1800;
      let a = 1n;
      const tasks = await prisma.task.findMany({
        where: {
          type: 5,
          start_time: { gte: entTime, lt: startTime },
          private_key: { not: null },
        },
      });
      const rushList: telegramTask[] = tasks.map((task) => ({
        ...task,
        telegram_id: Number(task.telegram_id),
      }));
      if (rushList.length) {
        this.getPerRequest(rushList);
      }
    });
  }
  async getPerRequest(taskList: telegramTask[]) {
    for (let chainId of this.chainIds) {
      let list = [];
      let targets = [];
      taskList.forEach((item) => {
        if (item.chain_id == chainId && !this.rushSending.get(item.id)) {
          list.push(item);
          targets.push(`'${item.target}'`);
        }
      });
      const contracts = await prisma.contract.findMany({
        where: { address: { in: targets } },
      });
      for (let item of list) {
        let contract = contracts.find((items) => {
          return items.address == item.target;
        });
        if (contract) {
          item.encode_data = encodeRsuhData(JSON.parse(contract.pools), item);
        }
      }
      let { eligibleList } = await telegramBatchFuckTugou(list, chainId);
      if (eligibleList.length) {
        this.rushNow(eligibleList, chainId);
      }
    }
  }
  async rushNow(eligibleList: any[], chainId: number) {
    for (let item of eligibleList) {
      this.sendRushTransaction(item, chainId);
    }
  }
  async sendRushTransaction(item: any, chainId: number) {
    if (!this.rushSending.get(item.id)) {
      let web3: any = new Web3();
      this.rushSending.set(item.id, true);
      await prisma.task.delete({ where: { id: item.id } });
      const contract = await prisma.contract.findFirst({
        where: { address: item.target },
      });
      let msg = {
        message: {
          chat: {
            id: item.telegram_id,
          },
        },
      };
      pendingTamplate(
        this.bot,
        msg,
        contract,
        item.amount,
        item.signTx.transactionHash,
        5
      );
      let transaction: any = await sendSignedTransaction(
        item.target,
        item.chain_id,
        item.signTx,
        5
      );
      if (transaction.response_type == 1) {
        let outAmount = 0;
        let receiveAddress = item.address;
        transaction.transactionReceipt.logs.forEach((log) => {
          if (
            log.topics.length == 3 &&
            web3.utils.toChecksumAddress(log.address) == item.target
          ) {
            let inAddress: string = web3.utils.toChecksumAddress(
              web3.eth.abi.decodeParameter("address", log.topics[2])
            );
            if (
              log.topics[0] ==
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
              inAddress == receiveAddress
            ) {
              outAmount += Number(
                web3.eth.abi.decodeParameter("uint256", log.data)
              );
            }
          }
        });
        let gasUsed =
          ((transaction.transactionReceipt.gasUsed *
            transaction.transactionReceipt.effectiveGasPrice) /
            10 ** 18) *
          this.sdks.get(chainId).wethPrice;
        let cost = Number(
          (item.amount * this.sdks.get(chainId).wethPrice + gasUsed).toFixed(2)
        );
        let transactionLog: any = {
          chain_id: chainId,
          address: item.address,
          target: item.target,
          hash: transaction.hash,
          in_target: "0x0000000000000000000000000000000000000000",
          in_amount: item.amount,
          out_target: item.target,
          price: "",
          out_amount: BigNumber(
            outAmount / 10 ** Number(contract.decimals)
          ).toFixed(),
          telegram_id: item.telegram_id,
          telegram_name: item.telegram_name,
          type: 5,
          transfer_type: 1,
          is_sell: 0,
          status: 1,
          symbol: contract.symbol,
          cost: cost,
          remark: "swapsuccess",
          create_time: Math.round(new Date().getTime() / 1000),
        };
        transactionLog = await prisma.transferlog.create({
          data: transactionLog,
        });
        let user = await this.getUserSetting(item.telegram_id);
        buySuccessTemplate(
          this.bot,
          msg,
          {
            ...contract,
            fastGetContractPrice: await fastGetContractPrice(contract, chainId),
          },
          user,
          this.currentGasPrices.get(contract.chain_id),
          this.sdks.get(contract.chain_id).wethPrice,
          transactionLog
        );
      } else {
        let gasUsed = transaction.hash
          ? Number(
            (
              ((transaction.transactionReceipt.gasUsed *
                transaction.transactionReceipt.effectiveGasPrice) /
                10 ** 18) *
              this.sdks.get(chainId).wethPrice
            ).toFixed(2)
          )
          : 0;
        let cost = gasUsed;
        let transactionLog = {
          chain_id: chainId,
          address: item.address,
          target: item.target,
          price: "",
          hash: transaction.hash ? transaction.hash : "",
          in_target: "0x0000000000000000000000000000000000000000",
          in_amount: item.amount,
          out_target: item.target,
          out_amount: "0",
          telegram_id: item.telegram_id,
          telegram_name: item.telegram_name,
          type: 5,
          transfer_type: 1,
          is_sell: 0,
          status: 2,
          symbol: contract.symbol,
          cost: cost.toString(),
          remark: transaction.msg,
          create_time: Math.round(new Date().getTime() / 1000),
        };
        await prisma.transferlog.create({ data: transactionLog });
        errorTamplate(
          this.bot,
          msg,
          contract,
          item.amount,
          transaction.hash,
          5,
          transaction.msg
        );
      }
    }
  }
  async checkSwapFee(chainId: number) {
    const list = await prisma.contract.findMany({
      where: {
        chain_id: chainId,
        is_add_liquidity: 1,
        is_get_swap_fee: 0,
      },
    });
    for (let item of list) {
      const buyList = await prisma.event.findMany({
        where: {
          out_target: item.address,
        },
      });
      const sellList = await prisma.event.findMany({
        where: {
          in_target: item.address,
        },
      });
      if (buyList.length && sellList.length) {
        const orderedBuyList = _.orderBy(buyList, "out_swap_fee", "asc");
        const orderedSellList = _.orderBy(sellList, "in_swap_fee", "asc");
        item.buy_fee = orderedBuyList[0].out_swap_fee;
        item.sell_fee = orderedSellList[0].in_swap_fee;
        item.is_get_swap_fee = 1;
        const { address, ...data } = item;
        await prisma.contract.update({
          where: { address }, // Or the relevant unique identifier field
          data: data,
        });
      }
    }
  }
  fifteenMinutesData() {
    schedule.scheduleJob("0 */15 * * * *", async () => {
      for (let item of this.chainIds) {
        let currentList = await this.currentData(item);
        let perList = await this.perData(item);
        currentList.forEach((item) => {
          let find = perList.find((items) => {
            return items.address == item.address;
          });
          item.countPercent = this.countPercent(item, find, "count");
          item.holdersPercent = this.countPercent(item, find, "currentHolders");
          item.pricePercent = this.countPercent(item, find, "currentPrice");
          if (find) {
            item.hightPrice =
              item.hightPrice > find.hightPrice
                ? item.hightPrice
                : find.hightPrice;
            item.hightHolders =
              item.hightHolders > find.hightHolders
                ? item.hightHolders
                : find.hightHolders;
          }
          let historyPercent = 0;
          if (item.firstPrice) {
            if (item.currentPrice > Number(item.firstPrice)) {
              historyPercent = Number(
                (
                  (item.currentPrice / Number(item.firstPrice) - 1) *
                  100
                ).toFixed(2)
              );
            } else {
              historyPercent = -Number(
                (
                  (1 - Number(item.firstPrice) / item.currentPrice) *
                  100
                ).toFixed(2)
              );
            }
          }
          item.historyPercent = historyPercent;
        });
        currentList = _.orderBy(currentList, "count", "desc");
        currentList = currentList.slice(0, 5);
        currentList.forEach((items) => {
          items.currentPrice = BigNumber(
            Number(
              (items.currentPrice * this.sdks.get(item).wethPrice).toFixed(15)
            )
          ).toFixed();
          items.hightPrice = BigNumber(
            Number(
              (items.hightPrice * this.sdks.get(item).wethPrice).toFixed(15)
            )
          ).toFixed();
          items.firstPrice = BigNumber(
            Number(
              (items.firstPrice * this.sdks.get(item).wethPrice).toFixed(15)
            )
          ).toFixed();
          items.allInflow = Number(items.allInflow.toFixed(5));
          items.allBuy = Number(items.allBuy.toFixed(5));
          items.allSell = Number(items.allSell.toFixed(5));
          items.topHolderPercent = Number(items.topHolderPercent.toFixed(2));
        });
        if (this.topChartId && currentList.length) {
          topFifteenMinutesTemplate(this.bot, this.topChartId, currentList);
        }
      }
    });
  }
  countPercent(current: any, per: any, key: string) {
    if (per) {
      if (per[key] > current[key]) {
        return -Number(((1 - current[key] / per[key]) * 100).toFixed(2));
      } else {
        return Number(((current[key] / per[key] - 1) * 100).toFixed(2));
      }
    } else {
      return 0;
    }
  }
  async fiveMinute(currentList: any[], chainId: number) {
    let list = await this.alreadyData(currentList, chainId);
    for (let item of list) {
      let find: any = await prisma.analyzedata.findFirst({
        where: {
          address: item.address,
        },
        orderBy: {
          create_time: "desc",
        },
      });

      if (find) {
        find.currentHolders = find.holders;
        find.currentPrice = Number(find.price);
      }
      item.countPercent = this.countPercent(item, find, "count");
      item.holdersPercent = this.countPercent(item, find, "currentHolders");
      item.pricePercent = this.countPercent(item, find, "currentPrice");
      let historyPercent = 0;
      if (item.firstPrice) {
        if (item.currentPrice > Number(item.firstPrice)) {
          historyPercent = Number(
            ((item.currentPrice / Number(item.firstPrice) - 1) * 100).toFixed(2)
          );
        } else {
          historyPercent = -Number(
            ((1 - Number(item.firstPrice) / item.currentPrice) * 100).toFixed(2)
          );
        }
      }
      item.historyPercent = historyPercent;
    }
    list.forEach((items) => {
      items.currentPrice = BigNumber(
        Number(
          (items.currentPrice * this.sdks.get(chainId).wethPrice).toFixed(15)
        )
      ).toFixed();
      items.firstPrice = BigNumber(
        Number(
          (items.firstPrice * this.sdks.get(chainId).wethPrice).toFixed(15)
        )
      ).toFixed();
      items.allInflow = Number(items.allInflow.toFixed(5));
      items.allBuy = Number(items.allBuy.toFixed(5));
      items.allSell = Number(items.allSell.toFixed(5));
      items.topHolderPercent = Number(items.topHolderPercent.toFixed(2));
    });
    if (this.topChartId && currentList.length) {
      topFiveMinutesTemplate(this.bot, this.topChartId, list);
    }
  }
  async perData(chainId: number) {
    let endTime = Math.round(new Date().getTime() / 1000) - 900;
    let startTime = endTime - 900;
    let list: any = await prisma.analyzedata.findMany({
      where: {
        create_time: {
          gte: startTime,
          lt: endTime,
        },
        chain_id: chainId,
      },
    });

    let filterList = new Map();
    let addresses = list.map((item) => {
      item.price = Number(item.price);
      if (filterList.get(item.address)) {
        let itemList = filterList.get(item.address);
        itemList.push(item);
        filterList.set(item.address, itemList);
      } else {
        filterList.set(item.address, [item]);
      }
      return `'${item.address}'`;
    });
    let contracts: any = await prisma.contract.findMany({
      where: {
        address: {
          in: addresses,
        },
      },
    });
    let setList = [...filterList.values()];
    let countList = [];
    setList.forEach((data) => {
      let find = contracts.find((items) => {
        return items.address == data[0].address;
      });
      let sortCreate = _.orderBy(data, "create_time", "desc");
      let sortHolders = _.orderBy(data, "holders", "desc");
      let sortPrice = _.orderBy(data, "price", "desc");
      let pushItem = {
        address: sortCreate[0].address,
        symbol: find.symbol,
        chainId: chainId,
        currentHolders: sortCreate[0].holders,
        currentPrice: sortCreate[0].price,
        hightPrice: sortPrice[0].price,
        hightHolders: sortHolders[0].holders,
        smartMoney: sortCreate[0].smart_money,
        topHolderPercent: 0,
        allBuy: 0,
        allSell: 0,
        allInflow: 0,
        count: 0,
        firstPrice: find ? find.first_price : 0,
      };
      let topHolder = JSON.parse(sortCreate[0].top_holder);
      data.forEach((items) => {
        pushItem.count += items.count;
        pushItem.allBuy += items.buy_amount;
        pushItem.allSell += items.sell_amount;
        pushItem.allInflow += items.inflow;
      });
      topHolder.forEach((items) => {
        if (find) {
          let pools = JSON.parse(find.pools);
          let findPool = pools.find((pool) => {
            return pool.pool == items.address;
          });
          if (
            !findPool &&
            items.address != "0x000000000000000000000000000000000000dEaD" &&
            items.address != "0x0000000000000000000000000000000000000000"
          ) {
            pushItem.topHolderPercent += Number(items.percent);
          }
        } else {
          pushItem.topHolderPercent += Number(items.percent);
        }
      });
      countList.push(pushItem);
    });
    return countList;
  }
  async alreadyData(list: any[], chainId: number) {
    let handleList = [];
    let addresses = list.map((item) => {
      item.price = Number(item.price);
      return `'${item.address}'`;
    });
    let contracts: any = await prisma.contract.findMany({
      where: {
        address: {
          in: addresses,
        },
      },
    });

    list.forEach((data) => {
      let find = contracts.find((items) => {
        return items.address == data.address;
      });
      let pushItem = {
        address: data.address,
        chainId: chainId,
        currentHolders: data.holders,
        symbol: find.symbol,
        currentPrice: data.price,
        smartMoney: data.smart_money,
        topHolderPercent: 0,
        allBuy: data.buy_amount,
        allSell: data.sell_amount,
        allInflow: data.inflow,
        count: data.count,
        firstPrice: find ? find.first_price : 0,
      };
      let topHolder = JSON.parse(data.top_holder);
      topHolder.forEach((items) => {
        if (find) {
          let pools = JSON.parse(find.pools);
          let findPool = pools.find((pool) => {
            return pool.pool == items.address;
          });
          if (
            !findPool &&
            items.address != "0x000000000000000000000000000000000000dEaD" &&
            items.address != "0x0000000000000000000000000000000000000000" &&
            items.address != pushItem.address
          ) {
            pushItem.topHolderPercent += Number(items.percent);
          }
        } else {
          pushItem.topHolderPercent += Number(items.percent);
        }
      });
      handleList.push(pushItem);
    });
    return handleList;
  }
  async currentData(chainId: number, times: number = 900) {
    let time = Math.round(new Date().getTime() / 1000) - times;
    let list: any = await prisma.analyzedata.findMany({
      where: {
        create_time: {
          gte: time,
        },
        chain_id: chainId,
      },
    });
    let filterList = new Map();
    let addresses = list.map((item) => {
      item.price = Number(item.price);
      if (filterList.get(item.address)) {
        let itemList = filterList.get(item.address);
        itemList.push(item);
        filterList.set(item.address, itemList);
      } else {
        filterList.set(item.address, [item]);
      }
      return `'${item.address}'`;
    });
    let contracts: any = await prisma.contract.findMany({
      where: {
        address: {
          in: addresses,
        },
      },
    });

    let setList = [...filterList.values()];
    let countList = [];
    setList.forEach((data) => {
      let find = contracts.find((items) => {
        return items.address == data[0].address;
      });
      let sortCreate = _.orderBy(data, "create_time", "desc");
      let sortHolders = _.orderBy(data, "holders", "desc");
      let sortPrice = _.orderBy(data, "price", "desc");
      let pushItem = {
        address: sortCreate[0].address,
        chainId: chainId,
        currentHolders: sortCreate[0].holders,
        symbol: find.symbol,
        currentPrice: sortCreate[0].price,
        hightPrice: sortPrice[0].price,
        hightHolders: sortHolders[0].holders,
        smartMoney: sortCreate[0].smart_money,
        topHolderPercent: 0,
        allBuy: 0,
        allSell: 0,
        allInflow: 0,
        count: 0,
        firstPrice: find ? find.first_price : 0,
      };
      let topHolder = JSON.parse(sortCreate[0].top_holder);
      data.forEach((items) => {
        pushItem.count += items.count;
        pushItem.allBuy += items.buy_amount;
        pushItem.allSell += items.sell_amount;
        pushItem.allInflow += items.inflow;
      });
      topHolder.forEach((items) => {
        if (find) {
          let pools = JSON.parse(find.pools);
          let findPool = pools.find((pool) => {
            return pool.pool == items.address;
          });
          if (
            !findPool &&
            items.address != "0x000000000000000000000000000000000000dEaD" &&
            items.address != "0x0000000000000000000000000000000000000000" &&
            items.address != pushItem.address
          ) {
            pushItem.topHolderPercent += Number(items.percent);
          }
        } else {
          pushItem.topHolderPercent += Number(items.percent);
        }
      });
      countList.push(pushItem);
    });
    return countList;
  }
  async analyzeData() {
    let listBlockNumber = 0;
    schedule.scheduleJob("0 */5 * * * *", async () => {
      for (let item of this.chainIds) {
        let blockNumber = await getBlockNumber(item);
        let where;
        if (listBlockNumber) {
          where = {
            block_number: {
              gt: listBlockNumber, // Greater than listBlockNumber
            },
            chain_id: item, // Equals to item
            from_address: {
              not: "0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13", // Not equal to the specified address
            },
          };
        } else {
          let time = Math.round(new Date().getTime() / 1000) - 300;
          where = {
            create_time: {
              gte: time, // Greater than or equal to time
            },
            chain_id: item, // Equals to item
            from_address: {
              not: "0xae2Fc483527B8EF99EB5D9B44875F005ba1FaE13", // Not equal to the specified address
            },
          };
        }
        let list: any = await prisma.event.findMany({
          where,
          orderBy: {
            block_number: "desc",
          },
        });
        if (list.length) {
          listBlockNumber = list[0].block_number;
        }
        let formatAddresses = handleSwapEventAddress(list);
        formatAddresses = formatAddresses.splice(0, 30);
        let queryAddresses = formatAddresses.map((items) => {
          return `'${items.address}'`;
        });
        let contracts: any = await prisma.contract.findMany({
          where: {
            address: {
              in: queryAddresses,
            },
          },
        });
        let p = [];
        formatAddresses.forEach((items) => {
          p.push(
            this.handleAnalyzeData(items, blockNumber, list, contracts, item)
          );
        });
        this.analyzeDataPromiseAll(p, item);
      }
    });
  }
  analyzeDataPromiseAll(p: any, chainId: number) {
    Promise.all(p).then(async (res) => {
      let effectiveList = [];
      let events = [];
      let contracts = [];
      res.forEach((item) => {
        if (item) {
          effectiveList.push(item);
          events = events.concat(item.events);
          contracts.push(item.contract);
        }
      });
      let addresses = effectiveList.map((item) => {
        return item.address;
      });
      let result: any = getOtherToken(addresses, events, chainId);
      for (let item of result) {
        let contract: any = await prisma.contract.findFirst({
          where: {
            address: item,
          },
        });

        if (!contract || !contract.address) {
          contract = await this.insertContract(item, chainId);
          if (contract && contract.address) {
            contracts.push(contract);
          }
        } else {
          contracts.push(contract);
        }
      }
      contracts = await this.analyzeDataCheckPool(contracts, chainId);
      contracts.forEach((item) => {
        if (item.LiquidityPools && item.LiquidityPools.length) {
          item.price = item.LiquidityPools[0][item.symbol];
        }
      });
      let analyzeDataList = [];
      effectiveList.forEach((item) => {
        let events = item.events;
        let buyList = [];
        let sellList = [];
        let buyAmount = 0;
        let sellAmount = 0;
        events.forEach((event) => {
          if (event.in_target == item.address) {
            if (
              Config[chainId].stableContract.indexOf(event.out_target) == -1
            ) {
              let find = contracts.find((contract) => {
                return contract.address == event.out_target;
              });
              if (find) {
                let amount = Number(
                  (
                    Number(find.price) *
                    (Number(event.out_amount) / 10 ** Number(find.decimals))
                  ).toFixed(5)
                );
                sellAmount += Number.isNaN(amount) ? 0 : -amount;
                sellList.push({
                  hash: event.hash,
                  amount: Number(
                    (
                      Number(find.price) *
                      (Number(event.out_amount) / 10 ** Number(find.decimals))
                    ).toFixed(5)
                  ),
                });
              }
            } else {
              if (Config[chainId].stableContract[0] == event.out_target) {
                let amount = Number(
                  (Number(event.out_amount) / 10 ** 18).toFixed(5)
                );
                sellAmount += Number.isNaN(amount) ? 0 : -amount;
                sellList.push({
                  hash: event.hash,
                  amount: Number(
                    (Number(event.out_amount) / 10 ** 18).toFixed(5)
                  ),
                });
              } else {
                let amount = Number(
                  (
                    Number(event.out_amount) /
                    10 ** 6 /
                    this.sdks.get(chainId).wethPrice
                  ).toFixed(5)
                );
                sellAmount += Number.isNaN(amount) ? 0 : -amount;
                sellList.push({
                  hash: event.hash,
                  amount: Number(
                    (
                      Number(event.out_amount) /
                      10 ** 6 /
                      this.sdks.get(chainId).wethPrice
                    ).toFixed(5)
                  ),
                });
              }
            }
          } else if (event.out_target == item.address) {
            if (Config[chainId].stableContract.indexOf(event.in_target) == -1) {
              let find = contracts.find((contract) => {
                return contract.address == event.in_target;
              });
              if (find) {
                let amount = Number(
                  (
                    Number(find.price) *
                    (Number(event.in_amount) / 10 ** Number(find.decimals))
                  ).toFixed(5)
                );
                buyAmount += Number.isNaN(amount) ? 0 : amount;
                buyList.push({
                  hash: event.hash,
                  amount: Number(
                    (
                      Number(find.price) *
                      (Number(event.in_amount) / 10 ** Number(find.decimals))
                    ).toFixed(5)
                  ),
                });
              }
            } else {
              if (Config[chainId].stableContract[0] == event.in_target) {
                let amount = Number(
                  (Number(event.in_amount) / 10 ** 18).toFixed(5)
                );
                buyAmount += Number.isNaN(amount) ? 0 : amount;
                buyList.push({
                  hash: event.hash,
                  amount: Number(
                    (Number(event.in_amount) / 10 ** 18).toFixed(5)
                  ),
                });
              } else {
                let amount = Number(
                  (
                    Number(event.in_amount) /
                    10 ** 6 /
                    this.sdks.get(chainId).wethPrice
                  ).toFixed(5)
                );
                buyAmount += Number.isNaN(amount) ? 0 : amount;
                buyList.push({
                  hash: event.hash,
                  amount: Number(
                    (
                      Number(event.in_amount) /
                      10 ** 6 /
                      this.sdks.get(chainId).wethPrice
                    ).toFixed(5)
                  ),
                });
              }
            }
          }
        });
        item.price = item.contract.price;
        item.buy_list = JSON.stringify(buyList);
        item.sell_list = JSON.stringify(sellList);
        item.buy_amount = Math.round(buyAmount * 10000) / 10000;
        item.sell_amount = Math.round(sellAmount * 10000) / 10000;
        item.inflow = Math.round((buyAmount + sellAmount) * 10000) / 10000;
        delete item.contract;
        delete item.events;
        if (item.price) {
          analyzeDataList.push(item);
        }
      });
      if (analyzeDataList.length) {
        analyzeDataList = _.orderBy(analyzeDataList, "count", "desc");
        let topAnalyzeDataList = analyzeDataList.slice(0, 5);
        await this.fiveMinute(topAnalyzeDataList, chainId);
        await prisma.analyzedata.createMany({
          data: analyzeDataList,
        });
      }
    });
  }
  async checkSmartMoney(holders: any[], chainId: number) {
    let allSmartMoney: any = await prisma.smartmoneyaddress.findMany({
      where: {
        chain_id: chainId,
      },
    });
    let allCount = 0;
    holders.forEach((item) => {
      let find = allSmartMoney.find((items) => {
        return items.address == item.address;
      });
      if (find) {
        allCount += find.count;
      }
    });
    return allCount;
  }
  async handleAnalyzeData(
    item: any,
    blockNumber: number,
    swapEvents: swapEvent[],
    contracts: insertItem[],
    chainId: number
  ) {
    return new Promise(async (resolve) => {
      let contract = contracts.find((items) => {
        return items.address == item.address;
      });
      if (!contract || !contract.address) {
        contract = await this.insertContract(item.address, chainId);
        if (
          contract &&
          contract.address &&
          contract.block_number > Number(blockNumber) - 50000
        ) {
          let holders = await getAllHolder(contract, chainId);
          let events = swapEvents.filter((swapEvent) => {
            return (
              swapEvent.in_target == contract.address ||
              swapEvent.out_target == contract.address
            );
          });
          let insertItem = {
            address: contract.address,
            chain_id: chainId,
            holders: holders.length,
            top_holder: JSON.stringify(holders.slice(0, 20)),
            count: item.count,
            contract: contract,
            smart_money: await this.checkSmartMoney(holders, chainId),
            events,
            create_time: Math.round(new Date().getTime() / 1000),
          };
          resolve(insertItem);
          return;
        }
      } else if (
        contract &&
        contract.address &&
        contract.block_number > Number(blockNumber) - 50000
      ) {
        let holders = await getAllHolder(contract, chainId);
        let events = swapEvents.filter((swapEvent) => {
          return (
            swapEvent.in_target == contract.address ||
            swapEvent.out_target == contract.address
          );
        });
        let insertItem = {
          address: contract.address,
          chain_id: chainId,
          holders: holders.length,
          top_holder: JSON.stringify(holders.slice(0, 20)),
          smart_money: await this.checkSmartMoney(holders, chainId),
          count: item.count,
          events,
          contract: contract,
          create_time: Math.round(new Date().getTime() / 1000),
        };
        resolve(insertItem);
        return;
      }
      resolve(null);
    });
  }
  async checkFirstPrice(chainId: number) {
    if (!this.isCheckingPrice) {
      this.isCheckingPrice = true;
      let contracts: any = await prisma.contract.findMany({
        where: {
          chain_id: chainId,
          is_add_liquidity: 1,
          is_check_price: 0,
        },
      });

      let pools: pool[] = [];
      contracts.forEach((item) => {
        pools = pools.concat(JSON.parse(item.pools));
      });
      let handlePools: (v2Pool | v3Pool)[] = await batchAllPool(pools, chainId);
      let { hasLiquidityPools } = formatPool(contracts, handlePools);
      await setToken(contracts, hasLiquidityPools, chainId);
      let updateList = [];
      for (let item of contracts) {
        if (item.LiquidityPools) {
          let firstPrice = "0";
          let firstPoolBalance = "0";
          let blockNumber = 0;
          try {
            let result = await getFirstPrice(item);
            firstPrice = result.price;
            firstPoolBalance = result.poolBalance;
            blockNumber = result.firstBlockNumber;
          } catch (error) { }
          let updateItem = {
            address: item.address,
            liquidity_pools: JSON.stringify(item.LiquidityPools),
            is_add_liquidity: 1,
            is_check_price: 1,
            first_price: firstPrice,
            first_pool_balance: firstPoolBalance,
            block_number:
              item.block_number > 0 ? item.block_number : blockNumber,
          };
          updateList.push(updateItem);
        }
      }
      if (updateList.length) {
        await prisma.$transaction(
          updateList.map((item) =>
            prisma.contract.update({
              where: { address: item.address },
              data: item,
            })
          )
        );
      }
      this.isCheckingPrice = false;
    }
  }
  async analyzeDataCheckPool(contracts: insertItem[], chainId: number) {
    return new Promise<any[]>(async (resolve) => {
      let pools: pool[] = [];
      contracts.forEach((item) => {
        pools = pools.concat(JSON.parse(item.pools));
      });
      let handlePools: (v2Pool | v3Pool)[] = await batchAllPool(pools, chainId);
      let { hasLiquidityPools } = formatPool(contracts, handlePools);
      await setToken(contracts, hasLiquidityPools, chainId);
      resolve(contracts);
    });
  }
  //Check whether to join the pool
  async checkPool(chainId: number) {
    if (!this.isCheckingPool) {
      this.isCheckingPool = true;
      let time = Math.round(new Date().getTime() / 1000) - 86400 * 7;
      let contracts: any = await prisma.contract.findMany({
        where: {
          chain_id: chainId,
          create_time: {
            gte: time,
          },
          is_add_liquidity: 0,
        },
      });

      let pools: pool[] = [];
      contracts.forEach((item) => {
        pools = pools.concat(JSON.parse(item.pools));
      });
      let handlePools: (v2Pool | v3Pool)[] = await batchAllPool(pools, chainId);
      let { hasLiquidityPools } = formatPool(contracts, handlePools);
      await setToken(contracts, hasLiquidityPools, chainId);
      let updateList = [];
      for (let item of contracts) {
        if (item.LiquidityPools) {
          let firstPrice = "0";
          let firstPoolBalance = "0";
          try {
            let result = await getFirstPrice(item);
            firstPrice = result.price;
            firstPoolBalance = result.poolBalance;
          } catch (error) { }
          let updateItem = {
            address: item.address,
            liquidity_pools: JSON.stringify(item.LiquidityPools),
            is_add_liquidity: 1,
            is_check_price: 1,
            first_price: firstPrice,
            first_pool_balance: firstPoolBalance,
          };
          let updatedItem = Object.assign(item, updateItem);
          if (this.chatId) {
            createContractTemplate(
              this.bot,
              this.currentGasPrices.get(chainId),
              this.sdks.get(chainId).wethPrice,
              this.chatId,
              updatedItem
            );
          }
          updateList.push(updateItem);
        }
      }
      if (updateList.length) {
        await prisma.$transaction(
          updateList.map((item) =>
            prisma.contract.update({
              where: { address: item.address },
              data: item,
            })
          )
        );
      }
      this.isCheckingPool = false;
    }
  }
  //Insert a new constructionerc20contract
  async handleEventCallBack(res: callbackEvent) {
    if (res.createEvents.length) {
      let createEvents: any = res.createEvents;
      createEvents.forEach((item) => {
        item.block_number = res.blockNumber;
      });
      await prisma.contract.createMany({
        data: createEvents,
      });
    }
  }
  //Listening instruction
  listenCommand() {
    this.bot.onText(/\/start/, async (msg, match) => {
      if (msg.from.id == msg.chat.id) {
        this.setUserId(msg);
        homeTemplate(this.bot, msg);
      }
    });
    this.bot.onText(/\/menu/, async (msg, match) => {
      if (msg.from.id == msg.chat.id) {
        homeTemplate(this.bot, msg);
      }
    });
    this.bot.onText(/\/bindChannel/, async (msg, match) => {
      if (this.isAdmin(msg.from.username)) {
        this.chatId = msg.chat.id;
        this.bot.sendMessage(msg.chat.id, `Binding push channel success`);
      } else {
        this.bot.sendMessage(
          msg.chat.id,
          `You are not an administrator that cannot be set up`
        );
      }
    });
    this.bot.onText(/\/bindTopChannel/, async (msg, match) => {
      if (this.isAdmin(msg.from.username)) {
        this.topChartId = msg.chat.id;
        this.bot.sendMessage(msg.chat.id, `Binding push channel success`);
      } else {
        this.bot.sendMessage(
          msg.chat.id,
          `You are not an administrator that cannot be set up`
        );
      }
    });
    this.bot.onText(/\/whitelist (\w+)/, async (msg, match) => {
      if (this.isAdmin(msg.from.username)) {
        await prisma.whitelist.create({
          data: {
            telegram_name: match[1],
          }
        })
        this.bot.sendMessage(msg.chat.id, `Whitelist success`);
      } else {
        this.bot.sendMessage(
          msg.chat.id,
          `You are not an administrator that cannot be set up`
        );
      }
    })
  }
  async formartWatchLog(swapEvent: swapEvent, watchList: any[]) {
    const web3 = new Web3();
    let watchLogs = [];
    watchList.forEach((item) => {
      let type =
        Config[swapEvent.chain_id].stableContract.indexOf(
          swapEvent.in_target
        ) == -1
          ? 2
          : 1;
      let watchLog = {
        chain_id: swapEvent.chain_id,
        address: item.address,
        name: item.name,
        in_target: swapEvent.in_target,
        out_target: swapEvent.out_target,
        telegram_id: item.telegram_id,
        telegram_name: item.telegram_name,
        hash: swapEvent.hash,
        price: "",
        type,
        swap_fee: type == 1 ? swapEvent.out_swap_fee : swapEvent.in_swap_fee,
        amount_in: swapEvent.in_amount,
        amount_out: swapEvent.out_amount,
        cost:
          Number(swapEvent.effective_gas_price) * Number(swapEvent.gas_used),
        create_time: Math.round(new Date().getTime() / 1000),
      };
      watchLogs.push(watchLog);
    });
    let result = await handleWatchTransactions(
      watchLogs,
      this.sdks.get(swapEvent.chain_id).wethPrice,
      swapEvent.chain_id
    );
    for (let item1 of result) {
      let item: any = await prisma.watchlog.create({
        data: item1 as any,
      });
      if (await this.sendWatchLog(item)) {
        for (let watchItem of watchList) {
          if (
            item.type == 1 &&
            watchItem.address == item.address &&
            watchItem.follow_private_key &&
            watchItem.follow_buy == 1
          ) {
            this.handleFollowBuy(item, watchItem);
          }
          if (item.type == 2 && watchItem.follow_sell == 1) {
            let account = web3.eth.accounts.privateKeyToAccount(
              watchItem.follow_private_key
            );
            let find: any = await prisma.transferlog.findFirst({
              where: {
                is_sell: 0,
                status: 1,
                transfer_type: 1,
                address: account.address,
                target: item.in_target,
              },
            });

            if (find && watchItem.address == item.address) {
              this.handleFollowSell(item, watchItem);
            }
          }
        }
      }
    }
  }
  //Handle
  async handleWatchAndFollow(res: callbackEvent) {
    if (res.swapEvents.length) {
      await prisma.event.createMany({
        data: res.swapEvents,
      });
    }
    let time = dayjs(new Date().getTime()).format("MM-DD HH:mm:ss");
    console.log(
      `Belonging chain：${chainEnum[res.chainId]}，Block：${res.blockNumber
      }，Order：${res.transactions.length} Pen，Network speed ${res.ms
      } ms，${time}`
    );
    let watchList: any = await prisma.watch.findMany();
    const web3 = new Web3();
    res.swapEvents.forEach((event) => {
      let filter = watchList.filter((item) => {
        return web3.utils.toChecksumAddress(event.from_address) == item.address;
      });
      if (filter.length) {
        this.formartWatchLog(event, filter);
      }
    });
  }
  //Send monitoring instructions
  async sendWatchLog(item: watchLog) {
    let address = item.type == 1 ? item.out_target : item.in_target;
    let contract: any = await prisma.contract.findFirst({
      where: {
        address: address,
      },
    });

    if (address == Config[item.chain_id].stableContract[0]) {
      return false;
    }
    if (!contract || !contract.address) {
      contract = await this.insertContract(address, item.chain_id);
    }
    if (contract && contract.address) {
      contract.fastGetContractPrice = await fastGetContractPrice(
        contract,
        contract.chain_id
      );
      let user = await this.getUserSetting(item.telegram_id);
      if (item.type == 1) {
        watchLogBuyTemplate(
          this.bot,
          contract,
          item,
          user,
          this.currentGasPrices.get(contract.chain_id),
          this.sdks.get(contract.chain_id).wethPrice
        );
      } else {
        watchLogSellTemplate(
          this.bot,
          contract,
          item,
          user,
          this.currentGasPrices.get(contract.chain_id),
          this.sdks.get(contract.chain_id).wethPrice
        );
      }
    }
    return true;
  }
  //Listening message
  onMessage() {
    const web3 = new Web3();
    this.bot.on("message", async (msg: Message) => {
      if (msg.from.id == msg.chat.id) {
        this.isWhiteUser(msg)
        let user = await this.getUserSetting(msg.from.id);
        if (
          msg.reply_to_message &&
          user &&
          user.reaction_id == msg.reply_to_message.message_id
        ) {
          this.switchReplyMethod(msg, user.reaction_method);
        }
        //Surveillance if it is not referenced whether it is a search contract address
        if (web3.utils.isAddress(msg.text) && !msg.reply_to_message) {
          //Find it from the Curry first，If not, look at it from the block
          this.sendContract(msg.text, msg);
        }

      }
    });
  }

  async setUserId(msg: Message) {
    let find: any = await prisma.whitelist.findFirst(
      {
        where: {
          telegram_name: msg.from.username,
        }
      }
    )
    if (find) {
      await prisma.whitelist.update({
        where: {
          id: find.id
        },
        data: {
          telegram_id: msg.from.id
        }
      });
    }
  }
  async sendContract(address: string, msg: any) {
    const web3 = new Web3();
    //Find it from the Curry first，If not, look at it from the block
    let find: any = await prisma.contract.findFirst({
      where: {
        address: web3.utils.toChecksumAddress(address),
      },
    });

    if (find) {
      let contractPrice: any = await fastGetContractPrice(find, find.chain_id);
      find.fastGetContractPrice = contractPrice;
      //Find contract template
      contractTemplate(
        this.bot,
        msg,
        find,
        await this.getUserSetting(msg.from.id),
        this.currentGasPrices.get(find.chain_id),
        this.sdks.get(find.chain_id).wethPrice
      );
    } else {
      for (let item of this.chainIds) {
        let contract = await this.insertContract(address, item);
        if (contract) {
          let contractPrice: any = await fastGetContractPrice(contract, item);
          contract.fastGetContractPrice = contractPrice;
          contractTemplate(
            this.bot,
            msg,
            contract,
            await this.getUserSetting(msg.from.id),
            this.currentGasPrices.get(contract.chain_id),
            this.sdks.get(contract.chain_id).wethPrice
          );
          break;
        }
      }
    }
  }
  //Execute contract search insertion
  async insertContract(address: string, chainId: number) {
    let contracts = await addContract([address], chainId);
    if (contracts[0]) {
      let contract = contracts[0];
      contract.is_add_liquidity = 1;
      contract.update_time = 0;
      contract.create_time = Math.round(new Date().getTime() / 1000);
      await prisma.contract.create({
        data: contract,
      });

      return contract;
    } else {
      return null;
    }
  }
  //Update user configuration
  async updateUserSetting(update: any) {
    if (update.query) {
      update.query = JSON.stringify(update.query);
    }
    const { id, ...data } = update;

    await prisma.setting.update({
      where: { id: id },
      data: data,
    });
  }
  //Get user configuration
  async getUserSetting(id: number) {
    let insert;
    let find: any = await prisma.setting.findFirst({
      where: {
        telegram_id: id,
      },
    });
    if (!find) {
      insert = {
        telegram_id: id,
        manual_gas_fee: 10,
        follow_gas_fee: 10,
        rush_gas_fee: 10,
        rush_time: 0,
        sell_percent: 100,
        follow_swap_fee: 5,
        manual_swap_fee: 5,
        reaction_id: 0,
        reaction_method: null,
        default_address: null,
        default_private_key: null,
        set_type: 0,
        log_id: 0,
        chain_id: 1,
        amount: 0.01,
        rush_amount: 0.01,
        follow_amount: 0.01,
        query: "",
        create_time: Math.round(new Date().getTime() / 1000),
      };
      await prisma.setting.create({
        data: insert,
      });
    } else {
      if (find.query) {
        find.query = JSON.parse(find.query);
      }
    }
    return find ? find : insert;
  }

  async isWhiteUser(msg: any) {
    if (this.isAdmin(msg.from.username)) {
      return true;
    }

    let find: any = await prisma.whitelist.findFirst(
      {
        where: {
          telegram_name: msg.from.username,
        }
      }
    )
    if (find) {
      return true;
    } else {
      this.bot.sendMessage(
        msg.chat.id,
        `You don't have permission to use this bot.`
      );
      return false;
    }
  }
  //monitorbotButton
  botQuery() {
    this.bot.on("callback_query", async (query) => {
      await this.getUserSetting(query.from.id);
      this.switchRouter(query);
    });
  }
  //Surveying instruction
  switchReplyMethod(msg: Message, method: string) {
    switch (method) {
      case "classic_buy":
        console.log(msg);
        break;
      case "quick_buy_setting":
        this.quickBuySetting(msg);
        break;
      case "update_ramp_amount_1":
        this.rampBuySetting(msg, 1);
        break;
      case "update_ramp_amount_2":
        this.rampBuySetting(msg, 2);
        break;
      case "update_ramp_amount_3":
        this.rampBuySetting(msg, 3);
        break;
      case "update_ramp_amount_4":
        this.rampBuySetting(msg, 4);
        break;
      //Import wallet
      case "import_wallet":
        this.addWallet(msg);
        break;
      //Delete wallet
      case "delete_wallet":
        this.deleteWallet(msg);
        break;
      //Set the manual selling ratio
      case "set_sell_percent":
        this.setUserSetting(msg, "sell_percent");
        break;
      //Set the manual purchase amount
      case "set_buy_amount":
        this.setUserSetting(msg, "amount");
        break;
      //Set manuallygas
      case "set_gas_fee":
        this.setUserSetting(msg, "manual_gas_fee");
        break;
      //Set the manual slip point
      case "set_swap_fee":
        this.setUserSetting(msg, "manual_swap_fee");
        break;
      //Set up a single slip point
      case "set_follow_swap_fee":
        this.setFollowSetting(msg, "follow_swap_fee");
        break;
      //Set up and single amount
      case "set_follow_amount":
        this.setFollowSetting(msg, "follow_amount");
        break;
      //Set up to ordergas
      case "set_follow_gas_fee":
        this.setFollowSetting(msg, "follow_gas_fee");
        break;
      //Set the opening of the marketgas
      case "set_task_gas_fee":
        this.setTaskSetting(msg, "gas_fee");
        break;
      //Set the opening amount
      case "set_task_buy_amount":
        this.setTaskSetting(msg, "amount");
        break;
      //Set the opening time
      case "set_task_start_time":
        this.setTaskSetting(msg, "start_time");
        break;
      //set upprc
      case "change_prc":
        this.changeChainPrc(msg);
        break;
      case "smart_money":
        this.querySmarkMoney(msg);
        break;
      //Add monitoring
      case "add_watch":
        this.addWatch(msg);
        break;
      //Remarks and listening address
      case "bind_watch_name":
        this.markWatch(msg);
        break;
      //Add to open the market
      case "add_rush":
        this.addRush(msg);
        break;
    }
  }
  //Set up the opening wallet
  async setTaskWallet(msg: any, walletIndex: number, taskId: number) {
    let user = await this.getUserSetting(msg.from.id);
    let wallets: any = await prisma.wallet.findMany({
      where: {
        telegram_id: msg.from.id,
      },
    });

    let task: any = await prisma.task.findFirst({
      where: {
        id: taskId,
      },
    });

    if (task) {
      task.private_key = wallets[walletIndex].private_key;
      task.address = wallets[walletIndex].address;
      const { id, ...data } = task;

      await prisma.task.update({
        where: { id: id },
        data: data,
      });

      this.rushDetail(msg, task.id);
    }
    user.query = "";
    this.updateUserSetting(user);
  }
  //Set manually buying the default wallet
  async setDefaultWallet(
    msg: any,
    walletIndex: number,
    contractAddress: string
  ) {
    let user = await this.getUserSetting(msg.from.id);
    let wallets: any = await prisma.wallet.findMany({
      where: {
        telegram_id: msg.from.id,
      },
    });
    user.default_address = wallets[walletIndex].address;
    user.default_private_key = wallets[walletIndex].private_key;
    user.query = msg;

    let find: any = await prisma.contract.findFirst({
      where: {
        address: contractAddress,
      },
    });

    if (find) {
      let contractPrice: any = await fastGetContractPrice(find, find.chain_id);
      find.fastGetContractPrice = contractPrice;
      //Modify the query contract template
      editorContractTemplate(
        this.bot,
        find,
        user,
        this.currentGasPrices.get(find.chain_id),
        this.sdks.get(find.chain_id).wethPrice
      );
    } else {
      for (let item of this.chainIds) {
        let contract = await this.insertContract(msg.text, item);
        if (contract) {
          let contractPrice: any = await fastGetContractPrice(contract, item);
          contract.fastGetContractPrice = contractPrice;
          editorContractTemplate(
            this.bot,
            contract,
            user,
            this.currentGasPrices.get(find.chain_id),
            this.sdks.get(find.chain_id).wethPrice
          );
          break;
        }
      }
    }
    let newUser = { ...user };
    newUser.query = "";
    this.updateUserSetting(newUser);
  }
  //Set up with a single wallet
  async setFollowWallet(msg: any, walletIndex: number, watchId: number) {
    let wallets: any = await prisma.wallet.findMany({
      where: {
        telegram_id: msg.from.id,
      },
    });

    let find: any = await prisma.watch.findFirst({
      where: {
        id: watchId,
      },
    });

    if (find && wallets.length) {
      find.follow_private_key = wallets[walletIndex].private_key;
      await prisma.watch.update({
        where: { id: find.id },
        data: find,
      });
      msg.data = `/handle_watch ${find.address}`;
      this.switchRouter(msg);
    }
  }
  //set upprc
  async changeChainPrc(msg: Message) {
    let user = await this.getUserSetting(msg.from.id);
    this.sdks.get(user.chain_id).setPrc(msg.text);
    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    user.query = "";
    user.reaction_id = 0;
    user.reaction_method = "";
    user.set_type = 0;
    user.log_id = 0;
    this.updateUserSetting(user);
    this.bot.sendMessage(msg.chat.id, "set upprcsuccess");
  }
  //Set up and single configuration
  async setFollowSetting(msg: Message, key: string) {
    let value = msg.text;
    let user = await this.getUserSetting(msg.from.id);
    if (typeof Number(value) != "number") {
      this.bot.sendMessage(msg.chat.id, "input error");
      this.bot.deleteMessage(msg.chat.id, msg.message_id);
      this.bot.deleteMessage(msg.chat.id, user.reaction_id);
      user.query = "";
      user.reaction_id = 0;
      user.reaction_method = "";
      user.set_type = 0;
      user.log_id = 0;
      this.updateUserSetting(user);
      return;
    }
    let find: any = await prisma.watch.findFirst({
      where: {
        id: user.log_id,
        telegram_id: msg.from.id,
      },
    });

    if (find) {
      find[key] = value;
      await prisma.watch.update({
        where: { id: find.id },
        data: find,
      });
      user.query.data = `/handle_watch ${find.address}`;
      this.switchRouter(user.query);
    }

    let newUser = { ...user };
    newUser.query = "";
    newUser.reaction_id = 0;
    newUser.reaction_method = "";
    newUser.set_type = 0;
    newUser.log_id = 0;
    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    this.updateUserSetting(newUser);
  }
  //Set up and single configuration
  async setTaskSetting(msg: Message, key: string) {
    let value = msg.text;
    let user = await this.getUserSetting(msg.from.id);
    if (key == "start_time") {
      let date = msg.text.split("T").join(" ");
      value = Math.round(new Date(date).getTime() / 1000) + "";
      if (Number.isNaN(Number(value))) {
        this.bot.sendMessage(msg.chat.id, "input error");
        this.bot.deleteMessage(msg.chat.id, msg.message_id);
        this.bot.deleteMessage(msg.chat.id, user.reaction_id);
        user.query = "";
        user.reaction_id = 0;
        user.reaction_method = "";
        user.set_type = 0;
        user.log_id = 0;
        this.updateUserSetting(user);
        return;
      }
    }
    if (typeof Number(value) != "number") {
      this.bot.sendMessage(msg.chat.id, "input error");
      this.bot.deleteMessage(msg.chat.id, msg.message_id);
      this.bot.deleteMessage(msg.chat.id, user.reaction_id);
      user.query = "";
      user.reaction_id = 0;
      user.reaction_method = "";
      user.set_type = 0;
      user.log_id = 0;
      this.updateUserSetting(user);
      return;
    }
    let find: any = await prisma.task.findFirst({
      where: {
        id: user.log_id,
        telegram_id: msg.from.id,
      },
    });

    if (find) {
      find[key] = value;
      await prisma.task.update({
        where: { id: find.id },
        data: find,
      });
      this.rushDetail(user.query, find.id);
    }

    let newUser = { ...user };
    newUser.query = "";
    newUser.reaction_id = 0;
    newUser.reaction_method = "";
    newUser.set_type = 0;
    newUser.log_id = 0;
    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    this.updateUserSetting(newUser);
  }
  //Set user configuration
  async setUserSetting(msg: Message, key: string) {
    const web3 = new Web3();
    let value = msg.text;
    let user = await this.getUserSetting(msg.from.id);
    if (typeof Number(value) != "number") {
      this.bot.sendMessage(msg.chat.id, "input error");
      this.bot.deleteMessage(msg.chat.id, msg.message_id);
      this.bot.deleteMessage(msg.chat.id, user.reaction_id);
      user.query = "";
      user.reaction_id = 0;
      user.reaction_method = "";
      user.set_type = 0;
      user.log_id = 0;
      this.updateUserSetting(user);
      return;
    }
    user[key] = Number(value);
    let contractAddress = user.query.message.text.split("\n")[3];
    if (contractAddress) {
      //type == 1 Query the configuration on the contract template
      if (user.set_type == 1) {
        let find: any = await prisma.contract.findFirst({
          where: {
            address: web3.utils.toChecksumAddress(contractAddress),
          },
        });

        if (find) {
          find.fastGetContractPrice = await fastGetContractPrice(
            find,
            find.chain_id
          );
          await editorContractTemplate(
            this.bot,
            find,
            user,
            this.currentGasPrices.get(find.chain_id),
            this.sdks.get(find.chain_id).wethPrice
          );
          this.bot.deleteMessage(msg.chat.id, msg.message_id);
          this.bot.deleteMessage(msg.chat.id, user.reaction_id);
        } else {
          for (let item of this.chainIds) {
            let contract = await this.insertContract(msg.text, item);
            if (contract) {
              contract.fastGetContractPrice = await fastGetContractPrice(
                contract,
                contract.chain_id
              );
              await editorContractTemplate(
                this.bot,
                contract,
                user,
                this.currentGasPrices.get(find.chain_id),
                this.sdks.get(find.chain_id).wethPrice
              );
              this.bot.deleteMessage(msg.chat.id, msg.message_id);
              this.bot.deleteMessage(msg.chat.id, user.reaction_id);
              break;
            }
          }
        }
        //type == 2 Modify the configuration on the order template
      } else if (user.set_type == 2) {
        let find: any = await prisma.contract.findFirst({
          where: {
            address: web3.utils.toChecksumAddress(contractAddress),
          },
        });
        let transferLog: any = await prisma.transferlog.findFirst({
          where: { id: user.log_id },
        });

        find.fastGetContractPrice = await fastGetContractPrice(
          find,
          find.chain_id
        );
        await editorBuySuccessTemplate(
          this.bot,
          find,
          user,
          this.currentGasPrices.get(find.chain_id),
          this.sdks.get(find.chain_id).wethPrice,
          transferLog
        );
        this.bot.deleteMessage(msg.chat.id, msg.message_id);
        this.bot.deleteMessage(msg.chat.id, user.reaction_id);
        //type == 3 Set the configuration on the order template
      } else if (user.set_type == 3) {
        let find: any = await prisma.contract.findFirst({
          where: {
            address: web3.utils.toChecksumAddress(contractAddress),
          },
        });
        let transferLog: any = await prisma.transferlog.findFirst({
          where: { id: user.log_id },
        });

        find.fastGetContractPrice = await fastGetContractPrice(
          find,
          find.chain_id
        );
        await editorSellSuccessTemplate(
          this.bot,
          find,
          user,
          this.currentGasPrices.get(find.chain_id),
          this.sdks.get(find.chain_id).wethPrice,
          transferLog
        );
        this.bot.deleteMessage(msg.chat.id, msg.message_id);
        this.bot.deleteMessage(msg.chat.id, user.reaction_id);
        //type == 4 Set the configuration on the monitoring order template
      } else if (user.set_type == 4) {
        let find: any = await prisma.contract.findFirst({
          where: {
            address: web3.utils.toChecksumAddress(contractAddress),
          },
        });
        let watchLog: any = await prisma.watchlog.findFirst({
          where: { id: user.log_id },
        });
        find.fastGetContractPrice = await fastGetContractPrice(
          find,
          find.chain_id
        );

        if (watchLog.type == 1) {
          await editorWatchLogBuyTemplate(
            this.bot,
            find,
            watchLog,
            user,
            this.currentGasPrices.get(find.chain_id),
            this.sdks.get(find.chain_id).wethPrice
          );
        } else if (watchLog.type == 2) {
          await editorWatchLogSellTemplate(
            this.bot,
            find,
            watchLog,
            user,
            this.currentGasPrices.get(find.chain_id),
            this.sdks.get(find.chain_id).wethPrice
          );
        }
        this.bot.deleteMessage(msg.chat.id, msg.message_id);
        this.bot.deleteMessage(msg.chat.id, user.reaction_id);
      }
    }
    let newUser = { ...user };
    newUser.query = "";
    newUser.reaction_id = 0;
    newUser.reaction_method = "";
    newUser.set_type = 0;
    newUser.log_id = 0;
    this.updateUserSetting(newUser);
  }

  // Select Classic Buy
  async handleClassicBuy(msg: Message) {

  }
  //Delete the binding wallet
  async deleteWallet(msg: Message) {
    let address = msg.text;
    const web3 = new Web3();
    if (web3.utils.isAddress(address)) {
      let wallets: any = await prisma.wallet.findMany({
        where: {
          telegram_id: msg.from.id,
        },
      });

      if (wallets.length) {
        let find = wallets.find((item) => {
          return item.address == web3.utils.toChecksumAddress(address);
        });
        if (find) {
          let result: any = await prisma.wallet.delete({
            where: {
              id: find.id,
            },
          });

          if (result) {
            let user = await this.getUserSetting(msg.from.id);
            this.bot.deleteMessage(msg.chat.id, msg.message_id);
            this.bot.deleteMessage(msg.chat.id, user.reaction_id);
            let query = user.query;
            query.data = "wallet";
            this.switchRouter(query);
            user.query = "";
            user.reaction_id = 0;
            user.reaction_method = "";
            user.set_type = 0;
            user.log_id = 0;
            this.updateUserSetting(user);
            this.bot.sendMessage(
              msg.chat.id,
              "Delete the linked wallet address successfully"
            );
          } else {
            this.bot.sendMessage(
              msg.chat.id,
              "Delete the binding wallet address failed"
            );
          }
        } else {
          this.bot.sendMessage(
            msg.chat.id,
            "The wallet address is not binding"
          );
        }
      } else {
        this.bot.sendMessage(msg.chat.id, "No wallet is not bound yet");
      }
    } else {
      this.bot.sendMessage(msg.chat.id, "Enter the wallet address error");
    }
  }
  //Generate wallet
  async generateWallet(query) {
    const web3 = new Web3();
    let wallet: any = await prisma.wallet.findMany({
      where: {
        telegram_id: query.from.id,
      },
    });

    let account = web3.eth.accounts.create();
    if (wallet.length + 1 > 5) {
      this.bot.sendMessage(query.message.chat.id, `Excerant limit limit`);
    } else {
      let insertItem = {
        address: account.address,
        private_key: account.privateKey,
        telegram_id: query.from.id,
        telegram_name: query.from.first_name + query.from.last_name,
        create_time: Math.round(new Date().getTime() / 1000),
      };
      let result: any = await prisma.wallet.create({
        data: insertItem,
      });

      if (result) {
        let str = `<b>❗️❗️❗️ Do not disclose your private key to others</b>\n\n<em>address：${account.address}</em>\n\n<em>Private key：${account.privateKey}</em>`;
        this.bot.sendMessage(query.message.chat.id, str, {
          parse_mode: "HTML",
        });
        query.data = "wallet";
        this.switchRouter(query);
      } else {
        this.bot.sendMessage(query.message.chat.id, `Failure to bind accounts`);
      }
    }
  }
  //Add to open the market
  async addRush(msg: Message) {
    let address: string = msg.text;
    const web3 = new Web3();
    if (!web3.utils.isAddress(address)) {
      let user = await this.getUserSetting(msg.from.id);
      this.bot.deleteMessage(msg.chat.id, msg.message_id);
      this.bot.deleteMessage(msg.chat.id, user.reaction_id);
      let query = user.query;
      query.data = "rush";
      user.query = "";
      user.reaction_id = 0;
      user.reaction_method = "";
      user.set_type = 0;
      user.log_id = 0;
      this.updateUserSetting(user);
      this.bot.sendMessage(msg.chat.id, `Contract address error`);
      return;
    }
    //Find it from the Curry first，If not, look at it from the block
    let find: any = await prisma.contract.findFirst({
      where: {
        address: web3.utils.toChecksumAddress(address),
      },
    });

    if (find) {
      let contractPrice: any = await fastGetContractPrice(find, find.chain_id);
      find.fastGetContractPrice = contractPrice;
      let startTime = Math.round(new Date().getTime() / 1000) - 1800;
      let findTask: any = await prisma.task.findFirst({
        where: {
          target: address,
          type: 5,
          telegram_id: msg.from.id,
          start_time: {
            gte: startTime,
          },
        },
      });

      if (findTask) {
        let user = await this.getUserSetting(msg.from.id);
        this.bot.deleteMessage(msg.chat.id, msg.message_id);
        this.bot.deleteMessage(msg.chat.id, user.reaction_id);
        let query = user.query;
        query.data = "rush";
        user.query = "";
        user.reaction_id = 0;
        user.reaction_method = "";
        user.set_type = 0;
        user.log_id = 0;
        this.updateUserSetting(user);
        this.bot.sendMessage(
          msg.chat.id,
          `The start of the contract with the existence of the contract`
        );
        return;
      }
      let insert: any = {
        chain_id: find.chain_id,
        telegram_id: msg.from.id,
        telegram_name: msg.from.first_name + msg.from.last_name,
        target: address,
        amount: 0.01,
        type: 5,
        gas_fee: 10,
        start_time: Math.round(new Date().getTime() / 1000) + 900,
      };
      insert = await prisma.task.create({
        data: insert,
      });

      let user = await this.getUserSetting(msg.from.id);
      this.bot.deleteMessage(msg.chat.id, msg.message_id);
      this.bot.deleteMessage(msg.chat.id, user.reaction_id);
      let query = user.query;
      query.data = "rush";
      user.query = "";
      user.reaction_id = 0;
      user.reaction_method = "";
      user.set_type = 0;
      user.log_id = 0;
      this.updateUserSetting(user);
      //Find contract template
      rushDetailTemplate(
        this.bot,
        msg.from.id,
        find,
        insert,
        this.currentGasPrices.get(find.chain_id),
        this.sdks.get(find.chain_id).wethPrice
      );
    } else {
      for (let item of this.chainIds) {
        let contract = await this.insertContract(address, item);
        if (contract) {
          let contractPrice: any = await fastGetContractPrice(contract, item);
          contract.fastGetContractPrice = contractPrice;
          contractTemplate(
            this.bot,
            msg,
            contract,
            await this.getUserSetting(msg.from.id),
            this.currentGasPrices.get(contract.chain_id),
            this.sdks.get(contract.chain_id).wethPrice
          );
          break;
        }
      }
    }
  }

  // quick buy setting
  async quickBuySetting(msg: Message) {
    let user = await this.getUserSetting(msg.from.id);
    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    let query = user.query;
    query.data = "settings";
    this.switchRouter(query);
    user.query = "";
    user.reaction_id = 0;
    user.reaction_method = "";
    user.set_type = 0;
    user.log_id = 0;
    this.updateUserSetting(user);
    this.bot.sendMessage(msg.chat.id, `Set ${msg.text} to Classic Quick Buy amount successfully.`);
  }

  // ramp buy setting
  async rampBuySetting(msg: Message, index: number) {
    let user = await this.getUserSetting(msg.from.id);
    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    let query = user.query;
    query.data = "settings";
    this.switchRouter(query);
    user.query = "";
    user.reaction_id = 0;
    user.reaction_method = "";
    user.set_type = 0;
    user.log_id = 0;
    this.updateUserSetting(user);
    let indexString = '';
    switch (index) {
      case 1:
        indexString = '1st';
        break;
      case 2:
        indexString = '2nd';
        break;
      case 3:
        indexString = '3rd';
        break;
      default:
        indexString = `${index}th`;
    }
    this.bot.sendMessage(msg.chat.id, `Set ${msg.text} to Classic Ramp Buy ${indexString} amount successfully.`);
  }

  //Add wallet
  async addWallet(msg: Message) {
    let privateKey = msg.text;
    const web3 = new Web3();
    try {
      let wallet: any = await prisma.wallet.findMany({
        where: {
          telegram_id: msg.from.id,
        },
      });

      let account = web3.eth.accounts.privateKeyToAccount(privateKey);
      if (wallet.length + 1 > 5) {
        this.bot.sendMessage(msg.chat.id, `Excerant limit limit`);
      } else {
        let find: any = await prisma.wallet.findFirst({
          where: {
            telegram_id: msg.from.id,
            address: account.address,
          },
        });

        if (find) {
          this.bot.sendMessage(msg.chat.id, `Repeat the account`);
        } else {
          let insertItem = {
            address: account.address,
            private_key: privateKey,
            telegram_id: msg.from.id,
            telegram_name: msg.from.first_name + msg.from.last_name,
            create_time: Math.round(new Date().getTime() / 1000),
          };
          let result: any = await prisma.wallet.create({
            data: insertItem,
          });

          if (result) {
            let user = await this.getUserSetting(msg.from.id);
            this.bot.deleteMessage(msg.chat.id, msg.message_id);
            this.bot.deleteMessage(msg.chat.id, user.reaction_id);
            let query = user.query;
            query.data = "wallet";
            this.switchRouter(query);
            user.query = "";
            user.reaction_id = 0;
            user.reaction_method = "";
            user.set_type = 0;
            user.log_id = 0;
            this.updateUserSetting(user);
            this.bot.sendMessage(msg.chat.id, `Binding account successful`);
          } else {
            this.bot.sendMessage(msg.chat.id, `Failure to bind accounts`);
          }
        }
      }
    } catch (error) {
      this.bot.sendMessage(msg.chat.id, `Private key error`);
    }
  }
  //Add monitoring address
  async addWatch(msg: Message) {
    let user = await this.getUserSetting(msg.from.id);
    let addressArr = msg.text.split(",");
    const web3 = new Web3();
    let hasErrAddress = false;
    addressArr.forEach((item) => {
      hasErrAddress = web3.utils.isAddress(item) ? false : true;
    });
    if (hasErrAddress) {
      this.bot.sendMessage(msg.chat.id, "There is an error address");
    } else {
      let watchList: any = await prisma.watch.findMany({
        where: {
          telegram_id: msg.from.id,
        },
      });

      if (watchList.length + addressArr.length > 20) {
        this.bot.sendMessage(msg.chat.id, "Beyond binding restrictions");
      } else {
        let insertList = [];
        addressArr.forEach((item) => {
          let find = watchList.find((items) => {
            return items.address == item;
          });
          if (!find) {
            insertList.push({
              address: web3.utils.toChecksumAddress(item),
              follow_buy: 0,
              follow_sell: 0,
              follow_amount: 0.01,
              follow_gas_fee: 5,
              follow_swap_fee: 5,
              telegram_id: msg.from.id,
              telegram_name: msg.from.first_name + msg.from.last_name,
              create_time: Math.round(new Date().getTime() / 1000),
            });
          }
        });
        if (insertList.length) {
          await prisma.watch.createMany({
            data: insertList,
          });
        }
        user.query.data = "watch";
        this.switchRouter(user.query);
      }
    }
    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    user.query = "";
    user.reaction_id = 0;
    user.reaction_method = "";
    user.set_type = 0;
    user.log_id = 0;
    this.updateUserSetting(user);
  }
  //Remarks and listening address
  async markWatch(msg: Message) {
    let user = await this.getUserSetting(msg.from.id);
    const web3 = new Web3();
    let address = msg.reply_to_message.text.split("\n")[1];
    let find: any = await prisma.watch.findFirst({
      where: {
        address: web3.utils.toChecksumAddress(address),
        telegram_id: msg.from.id,
      },
    });

    if (find) {
      find.name = msg.text;
      await prisma.watch.update({
        where: { id: find.id },
        data: find,
      });
      user.query.data = `/handle_watch ${address}`;
      this.switchRouter(user.query);
    } else {
      this.bot.sendMessage(msg.chat.id, "The address was not found");
    }

    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    user.query = "";
    user.reaction_id = 0;
    user.reaction_method = "";
    user.set_type = 0;
    user.log_id = 0;
    this.updateUserSetting(user);
  }
  async rushDetail(query: any, id: number) {
    let task: any = await prisma.task.findFirst({
      where: { id: id },
    });

    let contract: any = await prisma.contract.findFirst({
      where: { address: task.target },
    });

    if (contract) {
      let contractPrice: any = await fastGetContractPrice(
        contract,
        contract.chain_id
      );
      contract.fastGetContractPrice = contractPrice;
      editorRushDetailTemplate(
        this.bot,
        query,
        contract,
        task,
        this.currentGasPrices.get(contract.chain_id),
        this.sdks.get(contract.chain_id).wethPrice
      );
    } else {
      this.bot.sendMessage(
        query.message.chat.id,
        "No contract information is found"
      );
    }
  }
  async deleteWatch(query: any, address: string) {
    const web3 = new Web3();

    let find: any = await prisma.watch.findFirst({
      where: {
        address: web3.utils.toChecksumAddress(address),
        telegram_id: query.from.id,
      },
    });

    if (find) {
      await prisma.watch.delete({
        where: { id: find.id },
      });
      query.data = "watch";
      this.switchRouter(query);
    } else {
      this.bot.sendMessage(query.message.chat.id, "The address was not found");
    }
  }
  //Matching
  async switchRouter(query: any) {
    switch (query.data) {
      //Homepage routing
      case "home":
        goBackHomeTemplate(this.bot, query.message);
        break;
      case "buy_modes":
        buyModesTemplate(this.bot, query.message);
        break;
      case "classic_buy":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Input contract address.`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "add_rush";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "settings":
        settingTemplate(this.bot, query.message);
        break;
      case "classic_buy_setting":
        classicBuySettingTemplate(this.bot, query.message);
        break;
      case "quick_buy_setting":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Input amount to quick buy.`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "quick_buy_setting";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "ramp_buy_setting":
        classicRampBuySettingTemplate(this.bot, query.message);
        break;
      case "update_ramp_amount_1":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Input 1st Ramp amount to update.`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "update_ramp_amount_1";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "update_ramp_amount_2":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Input 2nd Ramp amount to update.`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "update_ramp_amount_2";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "update_ramp_amount_3":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Input 3rd Ramp amount to update.`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "update_ramp_amount_3";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "update_ramp_amount_4":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Input 4th Ramp amount to update.`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "update_ramp_amount_4";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "rush":
        rushTemplate(this.bot, query.message);
        break;
      //Wallet
      case "wallet":
        walletTemplate(this.bot, query);
        break;
      //Add wallet route
      case "add_wallet":
        addWalletTemplate(this.bot, query);
        break;
      //Generate wallet
      case "generate_wallet":
        this.generateWallet(query);
        break;
      //Choose a wallet
      case "picker_wallet":
        pickerWalletTempalte(this.bot, query);
        break;
      //Listening address routing
      case "watch":
        watchTemplate(this.bot, query);
        break;
      //Delete wallet
      case "delete_wallet":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Please enter the wallet address to delete`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "delete_wallet";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      //set upprc
      case "smart_money":
        if (query.from.username == this.params.admins) {
          this.bot
            .sendMessage(
              query.message.chat.id,
              `Please enter the contract address to find smart money`,
              {
                reply_markup: {
                  force_reply: true,
                },
              }
            )
            .then(async (res) => {
              let user = await this.getUserSetting(query.from.id);
              user.reaction_id = res.message_id;
              user.reaction_method = "smart_money";
              user.query = query;
              this.updateUserSetting(user);
            });
          break;
        } else {
          this.bot.sendMessage(
            query.message.chat.id,
            `You are not an administrator that cannot be set up`
          );
        }
        break;
      case "set_prc":
        if (query.from.username == this.params.admins) {
          networkTemplate(this.bot, query, this.chainIds);
        } else {
          this.bot.sendMessage(
            query.message.chat.id,
            `You are not an administrator that cannot be set up`
          );
        }
        break;
      case "Ethereum":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `please enterEthereum prcLink replacement`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "change_prc";
            user.chain_id = 1;
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "Arbitrum":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `please enterArbitrum prcLink replacement`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "change_prc";
            user.chain_id = 42161;
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      case "Goerli":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `please enterGoerli prcLink replacement`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "change_prc";
            user.chain_id = 5;
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      //Import wallet
      case "import_wallet":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Please enter the private key binding`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "import_wallet";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      //Add the opening
      case "add_rush":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Please enter the contract address`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "add_rush";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      //Add address monitoring
      case "add_watch":
        this.bot
          .sendMessage(
            query.message.chat.id,
            `Please enter the address you need to listen to，Please use multiple,Separate examples0x,0x`,
            {
              reply_markup: {
                force_reply: true,
              },
            }
          )
          .then(async (res) => {
            let user = await this.getUserSetting(query.from.id);
            user.reaction_id = res.message_id;
            user.reaction_method = "add_watch";
            user.query = query;
            this.updateUserSetting(user);
          });
        break;
      //Back to homepage
      case "go_home":
        this.clearHistory(query);
        break;
    }
    let pickerFollowWallet = query.data.match(
      new RegExp(/\/picker_follow_wallet (.+)/)
    );
    if (pickerFollowWallet) {
      pickerFollowWalletTempalte(
        this.bot,
        query,
        Number(pickerFollowWallet[1])
      );
    }
    let pickerTaskWallet = query.data.match(
      new RegExp(/\/picker_task_wallet (.+)/)
    );
    if (pickerTaskWallet) {
      let task: any = await prisma.task.findFirst({
        where: { id: Number(pickerTaskWallet[1]) },
      });

      if (task) {
        pickerTaskWalletTempalte(this.bot, query, task);
      } else {
        this.bot.sendMessage(
          query.message.chat.id,
          `Failure to query the task`
        );
        return;
      }
    }

    //Set up to buy status
    let followBuyMatch = query.data.match(
      new RegExp(/\/set_follow_buy (.+) (.+)/)
    );
    if (followBuyMatch) {
      let logId = Number(followBuyMatch[2]);
      let find: any = await prisma.watch.findFirst({
        where: {
          id: logId,
          telegram_id: query.from.id,
        },
      });

      if (find) {
        if (!find.follow_private_key) {
          this.bot.sendMessage(
            query.message.chat.id,
            `Please choose the wallet first`
          );
          return;
        }
        find.follow_buy = find.follow_buy == 0 ? 1 : 0;
        const { id, ...data } = find;

        await prisma.watch.update({
          where: { id: id },
          data: data,
        });
        query.data = `/handle_watch ${find.address}`;
        this.switchRouter(query);
      }
      return;
    }
    //Set up and selling status
    let followSellMatch = query.data.match(
      new RegExp(/\/set_follow_sell (.+) (.+)/)
    );
    if (followSellMatch) {
      let logId = Number(followSellMatch[2]);
      let find: any = await prisma.watch.findFirst({
        where: {
          id: logId,
          telegram_id: query.from.id,
        },
      });

      if (find) {
        if (!find.follow_private_key) {
          this.bot.sendMessage(
            query.message.chat.id,
            "Please choose the wallet first"
          );
          return;
        }
        find.follow_sell = find.follow_sell === 0 ? 1 : 0;
        await prisma.watch.update({
          where: { id: find.id },
          data: find,
        });
        query.data = `/handle_watch ${find.address}`;
        this.switchRouter(query);
      }

      return;
    }
    //Set up to ordergas
    let followGasMatch = query.data.match(
      new RegExp(/\/set_follow_gas_fee (.+) (.+)/)
    );
    if (followGasMatch) {
      let type = Number(followGasMatch[1]);
      let logId = Number(followGasMatch[2]);
      this.bot
        .sendMessage(query.message.chat.id, `please entergastip`, {
          reply_markup: {
            force_reply: true,
          },
        })
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.set_type = type;
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_follow_gas_fee";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Set up a single slip point
    let followSwapFeeMatch = query.data.match(
      new RegExp(/\/set_follow_swap_fee (.+) (.+)/)
    );
    if (followSwapFeeMatch) {
      let type = Number(followSwapFeeMatch[1]);
      let logId = Number(followSwapFeeMatch[2]);
      this.bot
        .sendMessage(query.message.chat.id, `Please enter the sliding point`, {
          reply_markup: {
            force_reply: true,
          },
        })
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.set_type = type;
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_follow_swap_fee";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Set up with a single buy amount
    let followBuyAmountMatch = query.data.match(
      new RegExp(/\/set_follow_amount (.+) (.+)/)
    );
    if (followBuyAmountMatch) {
      let type = Number(followBuyAmountMatch[1]);
      let logId = Number(followBuyAmountMatch[2]);
      this.bot
        .sendMessage(
          query.message.chat.id,
          `Please enter the purchase amountETHUnit`,
          {
            reply_markup: {
              force_reply: true,
            },
          }
        )
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.set_type = type;
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_follow_amount";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Set manuallygas
    let gasMatch = query.data.match(new RegExp(/\/set_gas_fee (.+) (.+)/));
    if (gasMatch) {
      let type = Number(gasMatch[1]);
      let logId = Number(gasMatch[2]);
      this.bot
        .sendMessage(query.message.chat.id, `please entergastip`, {
          reply_markup: {
            force_reply: true,
          },
        })
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.set_type = type;
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_gas_fee";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Set manually buying sliding point
    let swapFeeMatch = query.data.match(new RegExp(/\/set_swap_fee (.+) (.+)/));
    if (swapFeeMatch) {
      let type = Number(swapFeeMatch[1]);
      let logId = Number(swapFeeMatch[2]);
      this.bot
        .sendMessage(query.message.chat.id, `Please enter the sliding point`, {
          reply_markup: {
            force_reply: true,
          },
        })
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.set_type = type;
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_swap_fee";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Set the manual purchase amount
    let buyAmountMatch = query.data.match(
      new RegExp(/\/set_buy_amount (.+) (.+)/)
    );
    if (buyAmountMatch) {
      let type = Number(buyAmountMatch[1]);
      let logId = Number(buyAmountMatch[2]);
      this.bot
        .sendMessage(
          query.message.chat.id,
          `Please enter the purchase amountETHUnit`,
          {
            reply_markup: {
              force_reply: true,
            },
          }
        )
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.set_type = type;
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_buy_amount";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Set the manual selling ratio
    let sell_percentMatch = query.data.match(
      new RegExp(/\/set_sell_percent (.+) (.+)/)
    );
    if (sell_percentMatch) {
      let type = Number(sell_percentMatch[1]);
      let logId = Number(sell_percentMatch[2]);
      this.bot
        .sendMessage(query.message.chat.id, `Please enter the selling ratio`, {
          reply_markup: {
            force_reply: true,
          },
        })
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.set_type = type;
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_sell_percent";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }

    //Set the opening of the marketgas
    let taskGasMatch = query.data.match(new RegExp(/\/set_task_gas_fee (.+)/));
    if (taskGasMatch) {
      let logId = Number(taskGasMatch[1]);
      this.bot
        .sendMessage(query.message.chat.id, `please entergas`, {
          reply_markup: {
            force_reply: true,
          },
        })
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_task_gas_fee";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    let taskAmountMatch = query.data.match(
      new RegExp(/\/set_task_buy_amount (.+)/)
    );
    if (taskAmountMatch) {
      let logId = Number(taskAmountMatch[1]);
      this.bot
        .sendMessage(
          query.message.chat.id,
          `Please enter the purchase amountETHUnit`,
          {
            reply_markup: {
              force_reply: true,
            },
          }
        )
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_task_buy_amount";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    let taskStartTimeMatch = query.data.match(
      new RegExp(/\/set_task_start_time (.+)/)
    );
    if (taskStartTimeMatch) {
      let logId = Number(taskStartTimeMatch[1]);
      this.bot
        .sendMessage(
          query.message.chat.id,
          `Please enter the start time format 2023/09/13T09:37:00`,
          {
            reply_markup: {
              force_reply: true,
            },
          }
        )
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.log_id = logId;
          user.reaction_id = res.message_id;
          user.reaction_method = "set_task_start_time";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Delete task
    let taskDeleteMatch = query.data.match(new RegExp(/\/delete_task (.+)/));
    if (taskDeleteMatch) {
      let logId = Number(taskDeleteMatch[1]);
      await prisma.task.delete({
        where: { id: logId },
      });
      query.data = "rush";
      this.switchRouter(query);
      return;
    }
    //Set up buying and selling wallets
    let setFollowWalletMatch = query.data.match(
      new RegExp(/\/set_follow_wallet (.+) (.+)/)
    );
    if (setFollowWalletMatch) {
      this.setFollowWallet(
        query,
        Number(setFollowWalletMatch[1]),
        Number(setFollowWalletMatch[2])
      );
      return;
    }
    //Set up buying and selling wallets
    let setWalletMatch = query.data.match(
      new RegExp(/\/set_default_wallet (.+) (.+)/)
    );
    if (setWalletMatch) {
      this.setDefaultWallet(
        query,
        Number(setWalletMatch[1]),
        setWalletMatch[2]
      );
      return;
    }
    let setTaskWalletMatch = query.data.match(
      new RegExp(/\/set_task_wallet (.+) (.+)/)
    );
    if (setTaskWalletMatch) {
      this.setTaskWallet(
        query,
        Number(setTaskWalletMatch[1]),
        Number(setTaskWalletMatch[2])
      );
      return;
    }
    //Manually
    let buyMatch = query.data.match(new RegExp(/\/buy (.+) (.+) (.+) (.+)/));
    if (buyMatch) {
      let user = await this.getUserSetting(query.from.id);
      this.handleManualBuy(
        query,
        Number(buyMatch[1]),
        buyMatch[2],
        Number(user.amount),
        Number(user.manual_swap_fee),
        Number(user.manual_gas_fee),
        Number(buyMatch[3]),
        Number(buyMatch[4])
      );
      return;
    }
    //Manually sell
    let sellMatch = query.data.match(new RegExp(/\/sell (.+) (.+) (.+) (.+)/));
    if (sellMatch) {
      let user = await this.getUserSetting(query.from.id);
      this.handleManualSell(
        query,
        Number(sellMatch[1]),
        sellMatch[2],
        Number(user.sell_percent),
        Number(user.manual_swap_fee),
        Number(user.manual_gas_fee),
        Number(sellMatch[3]),
        Number(sellMatch[4])
      );
      return;
    }
    //Delete monitoring
    let deleteWatchMatch = query.data.match(new RegExp(/\/delete_watch (.+)/));
    if (deleteWatchMatch) {
      this.deleteWatch(query, deleteWatchMatch[1]);
      return;
    }
    //Check the opening task
    let rushDetailMatch = query.data.match(new RegExp(/\/rush_detail (.+)/));
    if (rushDetailMatch) {
      this.rushDetail(query, Number(rushDetailMatch[1]));
      return;
    }
    //Remarks and listening address
    let bindWatchNameMatch = query.data.match(
      new RegExp(/\/bind_watch_name (.+)/)
    );
    if (bindWatchNameMatch) {
      this.bot
        .sendMessage(
          query.message.chat.id,
          `👇👇👇Remark name for the following address，Please enter the name you need to note\n${bindWatchNameMatch[1]}`,
          {
            reply_markup: {
              force_reply: true,
            },
          }
        )
        .then(async (res) => {
          let user = await this.getUserSetting(query.from.id);
          user.reaction_id = res.message_id;
          user.reaction_method = "bind_watch_name";
          user.query = query;
          this.updateUserSetting(user);
        });
      return;
    }
    //Details of monitoring address
    let handleWatchMatch = query.data.match(new RegExp(/\/handle_watch (.+)/));
    if (handleWatchMatch) {
      handleWatchTemplate(this.bot, query, handleWatchMatch[1]);
      return;
    }
    //Send contract to private chat
    let sendContractMatch = query.data.match(
      new RegExp(/\/send_contract (.+)/)
    );
    if (sendContractMatch) {
      this.sendContract(sendContractMatch[1], query);
      return;
    }
  }
  //Sell
  async handleManualSell(
    msg: any,
    chainId: number,
    address: string,
    percent: number,
    swapFee: number,
    gasFee: number,
    type: number,
    logId?: number
  ) {
    const web3: any = new Web3();
    let account = null;
    if (logId) {
      let log: any = await prisma.transferlog.findFirst({
        where: { id: logId },
      });
      let wallet: any = await prisma.wallet.findFirst({
        where: {
          address: log.address,
          telegram_id: msg.from.id,
        },
      });

      if (wallet) {
        account = web3.eth.accounts.privateKeyToAccount(wallet.private_key);
      } else {
        this.bot.sendMessage(
          msg.message.chat.id,
          "The wallet of the order has been deleted"
        );
        return;
      }
    } else {
      let user = await this.getUserSetting(msg.from.id);
      if (!user.default_address) {
        this.bot.sendMessage(msg.message.chat.id, "Please select a wallet");
        return;
      }
      account = web3.eth.accounts.privateKeyToAccount(user.default_private_key);
    }
    if (this.chainIds.indexOf(chainId) == -1) {
      this.bot.sendMessage(msg.message.chat.id, "chainidinvalid");
      return;
    }
    if (!web3.utils.isAddress(address)) {
      this.bot.sendMessage(msg.message.chat.id, "Contract address error");
      return;
    }
    if (typeof percent != "number") {
      this.bot.sendMessage(msg.message.chat.id, "Selling proportion error");
      return;
    }
    let contract: any = await prisma.contract.findFirst({
      where: {
        address: address,
      },
    });
    if (!contract || !contract.address) {
      contract = await this.insertContract(address, chainId);
      if (!contract.address) {
        return;
      }
    }
    let receiveAddress = account.address;
    let fastPrice: any = await fastGetContractPrice(
      contract,
      contract.chain_id
    );
    let balance = await batchCheckERC20Balance(
      [{ contractAddr: contract.address, owner: receiveAddress }],
      contract.chain_id
    );
    let amountIn =
      percent == 100
        ? Math.floor((Number(balance[0].balance) * Number(99.5)) / 100)
        : Math.floor((Number(balance[0].balance) * percent) / 100);
    if (fastPrice && fastPrice.price) {
      fastPrice.pool.tag = fastPrice.pool.version;
      let amountOut =
        (amountIn / 10 ** Number(contract.decimals)) *
        fastPrice.price *
        10 ** 18;
      let params: manualParams = {
        amountIn: BigNumber(amountIn).toFixed(),
        amountOut: BigNumber(
          Math.floor(amountOut - (amountOut * swapFee) / 100)
        ).toFixed(),
        chainId: contract.chain_id,
        contract: contract.address,
        swapFee: swapFee,
        gasFee: gasFee,
        pool: fastPrice.pool,
      };
      let result: any;
      result = await manualSwapSell(params, account.privateKey);
      if (result.success) {
        pendingTamplate(
          this.bot,
          msg,
          contract,
          Number(
            (Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)
          ),
          result.signTx.transactionHash,
          type
        );
        let transaction: any = await sendSignedTransaction(
          contract.address,
          contract.chain_id,
          result.signTx,
          type
        );
        if (transaction.response_type == 1) {
          let routes = getRoutes(contract.chain_id);
          let outAmount = 0;
          transaction.transactionReceipt.logs.forEach((log) => {
            if (
              web3.utils.toChecksumAddress(log.address) ==
              Config[contract.chain_id].stableContract[0] &&
              log.topics[0] ==
              "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65" &&
              routes.indexOf(
                web3.eth.abi.decodeParameter("address", log.topics[1])
              ) != -1
            ) {
              outAmount += Number(
                web3.eth.abi.decodeParameter("uint256", log.data)
              );
            }
          });
          let gasUsed =
            ((transaction.transactionReceipt.gasUsed *
              transaction.transactionReceipt.effectiveGasPrice) /
              10 ** 18) *
            Number(this.sdks.get(contract.chain_id).wethPrice);
          let cost = Number(
            (
              (outAmount / 10 ** 18) *
              Number(this.sdks.get(contract.chain_id).wethPrice) -
              gasUsed
            ).toFixed(2)
          );
          let transactionLog: any = {
            chain_id: contract.chain_id,
            address: account.address,
            target: contract.address,
            hash: transaction.hash,
            in_target: contract.address,
            price: fastPrice.price,
            in_amount: BigNumber(
              Number(amountIn) / 10 ** Number(contract.decimals)
            ).toFixed(),
            out_target: Config[contract.chain_id].stableContract[0],
            out_amount: BigNumber(outAmount / 10 ** 18).toFixed(),
            telegram_id: msg.from.id,
            telegram_name: msg.from.first_name + msg.from.last_name,
            type: type,
            transfer_type: 2,
            is_sell: 0,
            status: 1,
            symbol: contract.symbol,
            cost: cost,
            remark: "swapsuccess",
            create_time: Math.round(new Date().getTime() / 1000),
          };
          transactionLog = await prisma.transferlog.create({
            data: transactionLog,
          });
          contract.fastGetContractPrice = await fastGetContractPrice(
            contract,
            chainId
          );
          let user = await this.getUserSetting(msg.from.id);
          sellSuccessTemplate(
            this.bot,
            msg,
            contract,
            user,
            this.currentGasPrices.get(contract.chain_id),
            this.sdks.get(contract.chain_id).wethPrice,
            transactionLog
          );
          let find: any = await prisma.transferlog.findMany({
            where: {
              is_sell: 0,
              status: 1,
              transfer_type: 1,
              address: account.address,
              target: contract.address,
            },
          });

          if (find.length) {
            find.forEach((log) => {
              log.is_sell = 1;
            });
            await prisma.$transaction(
              find.map((log) =>
                prisma.transferlog.update({
                  where: { id: log.id },
                  data: { is_sell: 1 },
                })
              )
            );
          }
        } else {
          let gasUsed = transaction.hash
            ? ((transaction.transactionReceipt.gasUsed *
              transaction.transactionReceipt.effectiveGasPrice) /
              10 ** 18) *
            Number(this.sdks.get(contract.chain_id).wethPrice)
            : 0;
          let cost = gasUsed;
          let transactionLog: any = {
            chain_id: contract.chain_id,
            address: account.address,
            target: contract.address,
            hash: transaction.hash ? transaction.hash : "",
            in_target: contract.address,
            in_amount: BigNumber(
              Number(amountIn) / 10 ** Number(contract.decimals)
            ).toFixed(),
            out_target: Config[contract.chain_id].stableContract[0],
            out_amount: 0,
            price: fastPrice.price,
            telegram_id: msg.from.id,
            telegram_name: msg.from.first_name + msg.from.last_name,
            type: type,
            transfer_type: 2,
            is_sell: 0,
            status: 2,
            cost: cost,
            symbol: contract.symbol,
            remark: transaction.msg,
            create_time: Math.round(new Date().getTime() / 1000),
          };
          await prisma.transferlog.create({
            data: transactionLog,
          });
          errorTamplate(
            this.bot,
            msg,
            contract,
            Number(
              (Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)
            ),
            transaction.hash,
            type,
            transaction.msg
          );
        }
      } else {
        let transactionLog: any = {
          chain_id: contract.chain_id,
          address: account.address,
          target: contract.address,
          hash: "",
          in_target: contract.address,
          in_amount: BigNumber(
            Number(amountIn) / 10 ** Number(contract.decimals)
          ).toFixed(),
          out_target: Config[contract.chain_id].stableContract[0],
          out_amount: 0,
          price: fastPrice.price,
          telegram_id: msg.from.id,
          telegram_name: msg.from.first_name + msg.from.last_name,
          type: type,
          transfer_type: 2,
          is_sell: 0,
          status: 2,
          cost: 0,
          symbol: contract.symbol,
          remark: result.msg,
          create_time: Math.round(new Date().getTime() / 1000),
        };
        await prisma.transferlog.create({
          data: transactionLog,
        });
        errorTamplate(
          this.bot,
          msg,
          contract,
          Number(
            (Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)
          ),
          "",
          type,
          result.msg
        );
      }
    } else {
      errorTamplate(
        this.bot,
        msg,
        contract,
        Number((Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)),
        "",
        type,
        "Obtaining currency price failed"
      );
    }
  }
  //Sell
  async handleFollowSell(watchItem: watchLog, watch: any) {
    const web3: any = new Web3();
    let account = null;
    let msg = {
      message: {
        chat: {
          id: watch.telegram_id,
        },
      },
    };
    let address = watchItem.out_target;
    let chainId = watchItem.chain_id;
    let percent = 100;
    let swapFee = watch.follow_swap_fee;
    let gasFee = watch.follow_gas_fee;
    let type = 4;
    let contract: any = await prisma.contract.findFirst({
      where: {
        address: address,
      },
    });
    if (!contract || !contract.address) {
      contract = await this.insertContract(address, chainId);
      if (!contract.address) {
        return;
      }
    }
    let receiveAddress = account.address;
    let fastPrice: any = await fastGetContractPrice(
      contract,
      contract.chain_id
    );
    let balance = await batchCheckERC20Balance(
      [{ contractAddr: contract.address, owner: receiveAddress }],
      contract.chain_id
    );
    let amountIn =
      percent == 100
        ? Math.floor((Number(balance[0].balance) * Number(99.5)) / 100)
        : Math.floor((Number(balance[0].balance) * percent) / 100);
    if (fastPrice && fastPrice.price) {
      fastPrice.pool.tag = fastPrice.pool.version;
      let amountOut =
        (amountIn / 10 ** Number(contract.decimals)) *
        fastPrice.price *
        10 ** 18;
      let params: manualParams = {
        amountIn: BigNumber(amountIn).toFixed(),
        amountOut: BigNumber(
          Math.floor(amountOut - (amountOut * swapFee) / 100)
        ).toFixed(),
        chainId: contract.chain_id,
        contract: contract.address,
        swapFee: swapFee,
        gasFee: gasFee,
        pool: fastPrice.pool,
      };
      let result: any = await manualSwapSell(params, account.privateKey);
      if (result.success) {
        pendingTamplate(
          this.bot,
          msg,
          contract,
          Number(
            (Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)
          ),
          result.signTx.transactionHash,
          type
        );
        let transaction: any = await sendSignedTransaction(
          contract.address,
          contract.chain_id,
          result.signTx,
          type
        );
        if (transaction.response_type == 1) {
          let routes = getRoutes(contract.chain_id);
          let outAmount = 0;
          transaction.transactionReceipt.logs.forEach((log) => {
            if (
              web3.utils.toChecksumAddress(log.address) ==
              Config[contract.chain_id].stableContract[0] &&
              log.topics[0] ==
              "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65" &&
              routes.indexOf(
                web3.eth.abi.decodeParameter("address", log.topics[1])
              ) != -1
            ) {
              outAmount += Number(
                web3.eth.abi.decodeParameter("uint256", log.data)
              );
            }
          });
          let gasUsed =
            ((transaction.transactionReceipt.gasUsed *
              transaction.transactionReceipt.effectiveGasPrice) /
              10 ** 18) *
            Number(this.sdks.get(contract.chain_id).wethPrice);
          let cost = Number(
            (
              (outAmount / 10 ** 18) *
              Number(this.sdks.get(contract.chain_id).wethPrice) -
              gasUsed
            ).toFixed(2)
          );
          let transactionLog: any = {
            chain_id: contract.chain_id,
            address: account.address,
            target: contract.address,
            hash: transaction.hash,
            in_target: contract.address,
            price: fastPrice.price,
            in_amount: BigNumber(
              Number(amountIn) / 10 ** Number(contract.decimals)
            ).toFixed(),
            out_target: Config[contract.chain_id].stableContract[0],
            out_amount: BigNumber(outAmount / 10 ** 18).toFixed(),
            telegram_id: watch.telegram_id,
            telegram_name: watch.telegram_name,
            type: type,
            transfer_type: 2,
            is_sell: 0,
            status: 1,
            symbol: contract.symbol,
            cost: cost,
            remark: "swapsuccess",
            create_time: Math.round(new Date().getTime() / 1000),
          };
          transactionLog = await prisma.transferlog.create({
            data: transactionLog,
          });

          contract.fastGetContractPrice = await fastGetContractPrice(
            contract,
            chainId
          );
          let user = await this.getUserSetting(watch.telegram_id);
          sellSuccessTemplate(
            this.bot,
            msg,
            contract,
            user,
            this.currentGasPrices.get(contract.chain_id),
            this.sdks.get(contract.chain_id).wethPrice,
            transactionLog
          );
          let find: any = await prisma.transferlog.findMany({
            where: {
              is_sell: 0,
              status: 1,
              transfer_type: 1,
              address: account.address,
              target: contract.address,
            },
          });

          if (find.length) {
            find.forEach((log) => {
              log.is_sell = 1;
            });
            await prisma.$transaction(
              find.map((log) =>
                prisma.transferlog.update({
                  where: { id: log.id },
                  data: log,
                })
              )
            );
          }
        } else {
          let gasUsed = transaction.hash
            ? ((transaction.transactionReceipt.gasUsed *
              transaction.transactionReceipt.effectiveGasPrice) /
              10 ** 18) *
            Number(this.sdks.get(contract.chain_id).wethPrice)
            : 0;
          let cost = gasUsed;
          let transactionLog: any = {
            chain_id: contract.chain_id,
            address: account.address,
            target: contract.address,
            hash: transaction.hash ? transaction.hash : "",
            in_target: contract.address,
            in_amount: BigNumber(
              Number(amountIn) / 10 ** Number(contract.decimals)
            ).toFixed(),
            out_target: Config[contract.chain_id].stableContract[0],
            out_amount: 0,
            price: fastPrice.price,
            telegram_id: watch.telegram_id,
            telegram_name: watch.telegram_name,
            type: type,
            transfer_type: 2,
            is_sell: 0,
            status: 2,
            cost: cost,
            symbol: contract.symbol,
            remark: transaction.msg,
            create_time: Math.round(new Date().getTime() / 1000),
          };
          await prisma.transferlog.create({
            data: transactionLog,
          });

          errorTamplate(
            this.bot,
            msg,
            contract,
            Number(
              (Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)
            ),
            transaction.hash,
            type,
            transaction.msg
          );
        }
      } else {
        let transactionLog: any = {
          chain_id: contract.chain_id,
          address: account.address,
          target: contract.address,
          hash: "",
          in_target: contract.address,
          in_amount: BigNumber(
            Number(amountIn) / 10 ** Number(contract.decimals)
          ).toFixed(),
          out_target: Config[contract.chain_id].stableContract[0],
          out_amount: 0,
          price: fastPrice.price,
          telegram_id: watch.telegram_id,
          telegram_name: watch.telegram_name,
          type: type,
          transfer_type: 2,
          is_sell: 0,
          status: 2,
          cost: 0,
          symbol: contract.symbol,
          remark: result.msg,
          create_time: Math.round(new Date().getTime() / 1000),
        };
        await prisma.transferlog.create({
          data: transactionLog,
        });

        errorTamplate(
          this.bot,
          msg,
          contract,
          Number(
            (Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)
          ),
          "",
          type,
          result.msg
        );
      }
    } else {
      errorTamplate(
        this.bot,
        msg,
        contract,
        Number((Number(amountIn) / 10 ** Number(contract.decimals)).toFixed(3)),
        "",
        type,
        "Obtaining currency price failed"
      );
    }
  }
  //Buy
  async handleManualBuy(
    msg: any,
    chainId: number,
    address: string,
    amount: number,
    swapFee: number,
    gasFee: number,
    type: number,
    logId?: number
  ) {
    const web3: any = new Web3();
    let account = null;
    if (logId) {
      let log: any = await prisma.transferlog.findFirst({
        where: { id: logId },
      });
      let wallet: any = await prisma.wallet.findFirst({
        where: {
          address: log.address,
          telegram_id: msg.from.id,
        },
      });

      if (wallet) {
        account = web3.eth.accounts.privateKeyToAccount(wallet.private_key);
      } else {
        this.bot.sendMessage(
          msg.message.chat.id,
          "The wallet of the order has been deleted"
        );
        return;
      }
    } else {
      let user = await this.getUserSetting(msg.from.id);
      if (!user.default_address) {
        this.bot.sendMessage(msg.message.chat.id, "Please select a wallet");
        return;
      }
      account = web3.eth.accounts.privateKeyToAccount(user.default_private_key);
    }
    if (this.chainIds.indexOf(chainId) == -1) {
      this.bot.sendMessage(msg.message.chat.id, "chainidinvalid");
      return;
    }
    if (!web3.utils.isAddress(address)) {
      this.bot.sendMessage(msg.message.chat.id, "Contract address error");
      return;
    }
    if (typeof amount != "number") {
      this.bot.sendMessage(msg.message.chat.id, "Error");
      return;
    }
    let contract: any = await prisma.contract.findFirst({
      where: {
        address: address,
      },
    });

    if (!contract || !contract.address) {
      contract = await this.insertContract(address, chainId);
      if (!contract.address) {
        return;
      }
    }
    let fastPrice: any = await fastGetContractPrice(contract, chainId);
    if (fastPrice && fastPrice.price) {
      let amountOut =
        (amount / Number(fastPrice.price)) * 10 ** Number(contract.decimals);
      fastPrice.pool.tag = fastPrice.pool.version;
      let params: manualParams = {
        amountIn: BigNumber(amount * 10 ** 18).toFixed(),
        amountOut: BigNumber(
          Math.floor(amountOut - (amountOut * swapFee) / 100)
        ).toFixed(),
        chainId: contract.chain_id,
        contract: contract.address,
        swapFee: swapFee,
        gasFee: gasFee,
        pool: fastPrice.pool,
      };
      let result = await manualSwapBuy(params, account.privateKey);
      if (result.success) {
        pendingTamplate(
          this.bot,
          msg,
          contract,
          amount,
          result.signTx.transactionHash,
          type
        );
        let transaction: any = await sendSignedTransaction(
          contract.address,
          contract.chain_id,
          result.signTx,
          type
        );
        if (transaction.response_type == 1) {
          let outAmount = 0;
          let receiveAddress = account.address;
          transaction.transactionReceipt.logs.forEach((log) => {
            if (
              log.topics.length == 3 &&
              web3.utils.toChecksumAddress(log.address) == address
            ) {
              let inAddress: string = web3.utils.toChecksumAddress(
                web3.eth.abi.decodeParameter("address", log.topics[2])
              );
              if (
                log.topics[0] ==
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
                inAddress == receiveAddress
              ) {
                outAmount += Number(
                  web3.eth.abi.decodeParameter("uint256", log.data)
                );
              }
            }
          });
          let gasUsed =
            ((transaction.transactionReceipt.gasUsed *
              transaction.transactionReceipt.effectiveGasPrice) /
              10 ** 18) *
            this.sdks.get(chainId).wethPrice;
          let cost = Number(
            (amount * this.sdks.get(chainId).wethPrice + gasUsed).toFixed(2)
          );
          let transactionLog: any = {
            chain_id: chainId,
            address: account.address,
            target: address,
            hash: transaction.hash,
            in_target: "0x0000000000000000000000000000000000000000",
            in_amount: amount,
            out_target: address,
            price: fastPrice.price,
            out_amount: BigNumber(
              outAmount / 10 ** Number(contract.decimals)
            ).toFixed(),
            telegram_id: msg.from.id,
            telegram_name: msg.from.first_name + msg.from.last_name,
            type: type,
            transfer_type: 1,
            is_sell: 0,
            status: 1,
            symbol: contract.symbol,
            cost: cost,
            remark: "swapsuccess",
            create_time: Math.round(new Date().getTime() / 1000),
          };
          transactionLog = await prisma.transferlog.create({
            data: transactionLog,
          });

          contract.fastGetContractPrice = await fastGetContractPrice(
            contract,
            chainId
          );
          let user = await this.getUserSetting(msg.from.id);
          buySuccessTemplate(
            this.bot,
            msg,
            contract,
            user,
            this.currentGasPrices.get(contract.chain_id),
            this.sdks.get(contract.chain_id).wethPrice,
            transactionLog
          );
        } else {
          let gasUsed = transaction.hash
            ? Number(
              (
                ((transaction.transactionReceipt.gasUsed *
                  transaction.transactionReceipt.effectiveGasPrice) /
                  10 ** 18) *
                this.sdks.get(chainId).wethPrice
              ).toFixed(2)
            )
            : 0;
          let cost = gasUsed;
          let transactionLog: any = {
            chain_id: chainId,
            address: account.address,
            target: address,
            price: fastPrice.price,
            hash: transaction.hash ? transaction.hash : "",
            in_target: "0x0000000000000000000000000000000000000000",
            in_amount: amount,
            out_target: address,
            out_amount: 0,
            telegram_id: msg.from.id,
            telegram_name: msg.from.first_name + msg.from.last_name,
            type: type,
            transfer_type: 1,
            is_sell: 0,
            status: 2,
            symbol: contract.symbol,
            cost: cost,
            remark: transaction.msg,
            create_time: Math.round(new Date().getTime() / 1000),
          };
          await prisma.transferlog.create({
            data: transactionLog,
          });

          errorTamplate(
            this.bot,
            msg,
            contract,
            amount,
            transaction.hash,
            type,
            transaction.msg
          );
        }
      } else {
        let transactionLog: any = {
          chain_id: chainId,
          address: account.address,
          target: address,
          hash: "",
          in_target: "0x0000000000000000000000000000000000000000",
          in_amount: amount,
          out_target: address,
          out_amount: 0,
          telegram_id: msg.from.id,
          price: fastPrice.price,
          telegram_name: msg.from.first_name + msg.from.last_name,
          type: type,
          transfer_type: 1,
          is_sell: 0,
          status: 2,
          symbol: contract.symbol,
          cost: 0,
          remark: result.msg,
          create_time: Math.round(new Date().getTime() / 1000),
        };
        await prisma.transferlog.create({
          data: transactionLog,
        });

        errorTamplate(this.bot, msg, contract, amount, "", type, result.msg);
      }
    } else {
      errorTamplate(
        this.bot,
        msg,
        contract,
        amount,
        "",
        type,
        "Obtaining currency price failed"
      );
    }
  }
  //Follow a single buy
  async handleFollowBuy(watchItem: watchLog, watch: any) {
    const web3: any = new Web3();
    let account = null;
    let msg = {
      message: {
        chat: {
          id: watch.telegram_id,
        },
      },
    };
    let address = watchItem.out_target;
    let chainId = watchItem.chain_id;
    let amount = watch.follow_amount;
    let swapFee = watch.follow_swap_fee;
    let gasFee = watch.follow_gas_fee;
    let type = 3;
    account = web3.eth.accounts.privateKeyToAccount(watch.follow_private_key);
    let contract: any = await prisma.contract.findFirst({
      where: {
        address: address,
      },
    });

    if (!contract || !contract.address) {
      contract = await this.insertContract(address, chainId);
      if (!contract.address) {
        return;
      }
    }
    let fastPrice: any = await fastGetContractPrice(contract, chainId);
    if (fastPrice && fastPrice.price) {
      let amountOut =
        (amount / Number(fastPrice.price)) * 10 ** Number(contract.decimals);
      fastPrice.pool.tag = fastPrice.pool.version;
      let params: manualParams = {
        amountIn: BigNumber(amount * 10 ** 18).toFixed(),
        amountOut: BigNumber(
          Math.floor(amountOut - (amountOut * swapFee) / 100)
        ).toFixed(),
        chainId: contract.chain_id,
        contract: contract.address,
        swapFee: swapFee,
        gasFee: gasFee,
        pool: fastPrice.pool,
      };
      let result = await manualSwapBuy(params, account.privateKey);
      if (result.success) {
        pendingTamplate(
          this.bot,
          msg,
          contract,
          amount,
          result.signTx.transactionHash,
          type
        );
        let transaction: any = await sendSignedTransaction(
          contract.address,
          contract.chain_id,
          result.signTx,
          type
        );
        if (transaction.response_type == 1) {
          let outAmount = 0;
          let receiveAddress = account.address;
          transaction.transactionReceipt.logs.forEach((log) => {
            if (
              log.topics.length == 3 &&
              web3.utils.toChecksumAddress(log.address) == address
            ) {
              let inAddress: string = web3.utils.toChecksumAddress(
                web3.eth.abi.decodeParameter("address", log.topics[2])
              );
              if (
                log.topics[0] ==
                "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" &&
                inAddress == receiveAddress
              ) {
                outAmount += Number(
                  web3.eth.abi.decodeParameter("uint256", log.data)
                );
              }
            }
          });
          let gasUsed =
            ((transaction.transactionReceipt.gasUsed *
              transaction.transactionReceipt.effectiveGasPrice) /
              10 ** 18) *
            this.sdks.get(chainId).wethPrice;
          let cost = Number(
            (amount * this.sdks.get(chainId).wethPrice + gasUsed).toFixed(2)
          );
          let transactionLog: any = {
            chain_id: chainId,
            address: account.address,
            target: address,
            hash: transaction.hash,
            in_target: "0x0000000000000000000000000000000000000000",
            in_amount: amount,
            out_target: address,
            price: fastPrice.price,
            out_amount: BigNumber(
              outAmount / 10 ** Number(contract.decimals)
            ).toFixed(),
            telegram_id: watch.telegram_id,
            telegram_name: watch.telegram_name,
            type: type,
            transfer_type: 1,
            is_sell: 0,
            status: 1,
            symbol: contract.symbol,
            cost: cost,
            remark: "swapsuccess",
            create_time: Math.round(new Date().getTime() / 1000),
          };
          transactionLog = await prisma.transferlog.create({
            data: transactionLog,
          });

          contract.fastGetContractPrice = await fastGetContractPrice(
            contract,
            chainId
          );
          let user = await this.getUserSetting(watch.telegram_id);
          buySuccessTemplate(
            this.bot,
            msg,
            contract,
            user,
            this.currentGasPrices.get(contract.chain_id),
            this.sdks.get(contract.chain_id).wethPrice,
            transactionLog
          );
        } else {
          let gasUsed = transaction.hash
            ? Number(
              (
                ((transaction.transactionReceipt.gasUsed *
                  transaction.transactionReceipt.effectiveGasPrice) /
                  10 ** 18) *
                this.sdks.get(chainId).wethPrice
              ).toFixed(2)
            )
            : 0;
          let cost = gasUsed;
          let transactionLog: any = {
            chain_id: chainId,
            address: account.address,
            target: address,
            price: fastPrice.price,
            hash: transaction.hash ? transaction.hash : "",
            in_target: "0x0000000000000000000000000000000000000000",
            in_amount: amount,
            out_target: address,
            out_amount: 0,
            telegram_id: watch.telegram_id,
            telegram_name: watch.telegram_name,
            type: type,
            transfer_type: 1,
            is_sell: 0,
            status: 2,
            symbol: contract.symbol,
            cost: cost,
            remark: transaction.msg,
            create_time: Math.round(new Date().getTime() / 1000),
          };
          await prisma.transferlog.create({
            data: transactionLog,
          });

          errorTamplate(
            this.bot,
            msg,
            contract,
            amount,
            transaction.hash,
            type,
            transaction.msg
          );
        }
      } else {
        let transactionLog: any = {
          chain_id: chainId,
          address: account.address,
          target: address,
          hash: "",
          in_target: "0x0000000000000000000000000000000000000000",
          in_amount: amount,
          out_target: address,
          out_amount: 0,
          telegram_id: watch.telegram_id,
          telegram_name: watch.telegram_name,
          price: fastPrice.price,
          type: type,
          transfer_type: 1,
          is_sell: 0,
          status: 2,
          symbol: contract.symbol,
          cost: 0,
          remark: result.msg,
          create_time: Math.round(new Date().getTime() / 1000),
        };
        await prisma.transferlog.create({
          data: transactionLog,
        });
        errorTamplate(this.bot, msg, contract, amount, "", type, result.msg);
      }
    } else {
      errorTamplate(
        this.bot,
        msg,
        contract,
        amount,
        "",
        type,
        "Obtaining currency price failed"
      );
    }
  }
  // Find smart money
  async querySmarkMoney(msg: Message) {
    const web3 = new Web3();
    let user = await this.getUserSetting(msg.from.id);
    let addresses = msg.text.split(",");
    let hasError = false;
    addresses.forEach((item) => {
      hasError = !web3.utils.isAddress(item);
      if (web3.utils.isAddress(item)) {
        item = web3.utils.toChecksumAddress(item);
      }
    });
    this.bot.deleteMessage(msg.chat.id, msg.message_id);
    this.bot.deleteMessage(msg.chat.id, user.reaction_id);
    let newUser = { ...user };
    newUser.query = "";
    newUser.reaction_id = 0;
    newUser.reaction_method = "";
    newUser.set_type = 0;
    newUser.log_id = 0;
    this.updateUserSetting(newUser);
    if (hasError) {
      this.bot.sendMessage(msg.chat.id, "The contract address is wrong");
    } else {
      let values = addresses.map((item) => {
        return `'${item}'`;
      });
      let list: any = await prisma.smartmoney.findMany({
        where: {
          address: {
            in: values,
          },
        },
      });
      if (list.length) {
        this.bot.sendMessage(msg.chat.id, "Contracts are dw -entry");
      } else {
        this.bot.sendMessage(msg.chat.id, "Start finding smart money");
        for (let address of addresses) {
          let find: any = await prisma.contract.findFirst({
            where: {
              address: web3.utils.toChecksumAddress(address),
            },
          });
          let allSmartMoney: any = await prisma.smartmoneyaddress.findMany();
          if (find) {
            let result = await getSmartMoney([find.address], find.chain_id);
            let updateList = [];
            let insertList = [];
            for (let userItem of result) {
              let findAddress = allSmartMoney.find(
                (items) =>
                  items.address === userItem.address &&
                  userItem.chain_id === find.chain_id
              );
              if (findAddress) {
                findAddress.count += 1;
                updateList.push(findAddress);
              } else {
                insertList.push({
                  address: userItem.address,
                  chain_id: find.chain_id,
                  count: 1,
                  create_time: Math.round(new Date().getTime() / 1000),
                });
              }
            }
            if (updateList.length) {
              await prisma.$transaction(
                updateList.map((item) =>
                  prisma.smartmoneyaddress.update({
                    where: { id: item.id },
                    data: item,
                  })
                )
              );
            }
            if (insertList.length) {
              await prisma.smartmoneyaddress.createMany({
                data: insertList,
              });
            }
            await prisma.smartmoney.create({
              data: {
                address: find.address,
                chain_id: find.chain_id,
                create_time: Math.round(new Date().getTime() / 1000),
              },
            });
          } else {
            for (let item of this.chainIds) {
              let contract: any = await this.insertContract(address, item);
              if (contract) {
                let result = await getSmartMoney(
                  [contract.address],
                  contract.chain_id
                );
                let updateList = [];
                let insertList = [];
                for (let userItem of result) {
                  let findAddress = allSmartMoney.find(
                    (items) =>
                      items.address === userItem.address &&
                      userItem.chain_id === contract.chain_id
                  );
                  if (findAddress) {
                    findAddress.count += 1;
                    updateList.push(findAddress);
                  } else {
                    insertList.push({
                      address: userItem.address,
                      chain_id: contract.chain_id,
                      count: 1,
                      create_time: Math.round(new Date().getTime() / 1000),
                    });
                  }
                }
                if (updateList.length) {
                  await prisma.$transaction(
                    updateList.map((item) =>
                      prisma.smartmoneyaddress.update({
                        where: { id: item.id },
                        data: item,
                      })
                    )
                  );
                }
                if (insertList.length) {
                  await prisma.smartmoneyaddress.createMany({
                    data: insertList,
                  });
                }
                await prisma.smartmoney.create({
                  data: {
                    address: contract.address,
                    chain_id: contract.chain_id,
                    create_time: Math.round(new Date().getTime() / 1000),
                  },
                });
                break;
              }
            }
          }
        }
        this.bot.sendMessage(msg.chat.id, "Smart money has been entered");
      }
    }
  }
  //Back to homepage
  clearHistory(query: any) {
    query.data = "home";
    this.switchRouter(query);
  }
}
