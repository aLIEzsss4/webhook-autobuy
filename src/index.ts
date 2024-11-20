import { Hono } from "hono";
import * as chains from "viem/chains";
import { handleEVMTransaction } from "./evm";
import { createSolanaService } from "./solana";

const app = new Hono();

export interface Token {
  address: string;
  chain: string;
  name: string;
}

interface WebhookPayload {
  tokens: Token[];
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: {
    chainId: string;
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      address: string;
      name: string;
      symbol: string;
    };
  }[];
}

interface TradingPayload {
  chain: string;
  address: string;
  amount: number;
  maxSlippage: number;
}

app.get("/", (c) => {
  return c.text("Trading Bot is running!");
});

app.post("/webhook", async (c) => {
  try {
    const payload: WebhookPayload = await c.req.json();

    if (c.req.header("X-API-KEY") !== "1234567890") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    for (const token of payload.tokens) {
      let { address, chain, name } = token;

      if (!token.chain) {
        return c.json({ error: "Chain is required" }, 400);
      }

      if (token.name && !token.address) {
        address = await queryAddressBySymbol(token);
      }

      if (chain === "solana") {
        console.log("Solana transaction");

        const swapService = createSolanaService();

        const result = await swapService.swap({
          inputMint: "So11111111111111111111111111111111111111112", // SOL
          outputMint: "9PR7nCP9DpcUotnDPVLUBUZKu5WAYkwrCUx9wDnSpump", // BAN
          amount: 0.001,
        });

        return c.json({
          status: "success",
          message: `result: ${result}`,
          time: new Date().toISOString(),
        });
      }

      if (
        Object.values(chains).find(
          (c) => c.name.toLowerCase() === chain.toLowerCase()
        )
      ) {
        handleEVMTransaction(token);
      } else {
        return c.json({ error: "Invalid chain" }, 400);
      }
    }

    return c.json({
      status: "success",
      message: `Processed ${payload.tokens.length} tokens`,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

async function queryAddressBySymbol(token: Token) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${token.name}`
    );

    const data: DexScreenerResponse = await response.json();

    const chainMapping: { [key: string]: string } = {
      BSC: "bsc",
      ETH: "ethereum",
      SOLANA: "solana",
    };

    const targetChainId = chainMapping[token.chain.toUpperCase()];

    const matchedPair = data.pairs.find(
      (pair) => pair.chainId.toLowerCase() === targetChainId.toLowerCase()
    );

    if (!matchedPair) {
      throw new Error(`No pairs found for chain: ${token.chain}`);
    }

    return matchedPair.baseToken.address;
  } catch (error) {
    console.error("Error querying address by symbol:", error);
    throw error;
  }
}

export default app;
