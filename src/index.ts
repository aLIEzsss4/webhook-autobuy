import { Hono } from "hono";
import * as chains from "viem/chains";
import { handleEVMTransaction } from "./evm";
import { createSolanaService, RaydiumTradePayload } from "./solana";
import { verifyWebhookSignature } from "./utils/utils";

const app = new Hono();

export interface Token {
  inputMint?: string;
  outputMint: string;
  amount: number;
  chain?: string;
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

app.post("/raydiumTrade", async (c) => {
  const payload: RaydiumTradePayload = await c.req.json();

  console.log(payload);

  return c.json({ status: "success" });
});

app.post("/webhook", async (c) => {
  try {
    if (
      !verifyWebhookSignature(
        c.req.raw,
        c.req.header("X-Signature"),
        c.env.WEBHOOK_SECRET
      )
    ) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload: WebhookPayload = await c.req.json();

    for (const token of payload.tokens) {
      let { inputMint, outputMint, amount, chain } = token;

      if (chain === "solana") {
        console.log("Solana transaction");

        const swapService = createSolanaService(c.env);

        const result = await swapService.swap({
          inputMint: inputMint || "So11111111111111111111111111111111111111112", // SOL
          outputMint: outputMint,
          amount: amount,
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

export default {
  fetch: app.fetch,
};
