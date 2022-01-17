import fetch from "isomorphic-fetch";
import {
  MsgExecuteContract,
  MnemonicKey,
  Coins,
  LCDClient,
} from "@terra-money/terra.js";
import { readFile } from "fs/promises";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch gas prices and convert to `Coin` format.
const gasPrices = await (
  await fetch("https://fcd.terra.dev/v1/txs/gas_prices")
).json();
const gasPricesCoins = new Coins(gasPrices);

const lcd = new LCDClient({
  URL: "https://lcd.terra.dev/",
  chainID: "columbus-5",
  gasPrices: gasPricesCoins,
  gasAdjustment: "1.5",
  gas: 10000000,
});

const mk = new MnemonicKey({
  mnemonic: process.env.KEY,
  coinType: 118,
});

const wallet = lcd.wallet(mk);

// Helper to cut an array into chunks.
const chunk = (arr, len) => {
  let chunks = [],
    i = 0,
    n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, (i += len)));
  }

  return chunks;
};

const main = async () => {
  const template = JSON.parse(await readFile("./template.json", "utf8"));
  const mintMessage = (tokenid, address) => ({
    mint: {
      owner: address,
      token_id: `${tokenid}`,
      ...template,
    },
  });

  const list = (await readFile("./list.txt", "utf8")).split("\r\n");
  const chunks = chunk(list, 100);
  let total = 0;
  for (const thisChunk of chunks) {

    const msgs = thisChunk.map((addr) => {
      const msg = mintMessage(total, addr);
      total++;
      return new MsgExecuteContract(
        wallet.key.accAddress,
        "terra18m7xzelpgnss5rdrtvjgv5eypynar9ay00kmzp",
        msg
      );
    });

    try {
      const tx = await wallet.createAndSignTx({ msgs });
      const result = await lcd.tx.broadcast(tx);
      console.log(result);
    } catch (e) {
      console.log(e);
    }

    await sleep(5000);
  }
};

main();
