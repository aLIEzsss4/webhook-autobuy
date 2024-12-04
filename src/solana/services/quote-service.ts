import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createJupiterApi } from "./jupiter-api";
import { QuoteParams } from "../types";
import { Env } from "../../types/env";

export const createQuoteService = (env: Env) => {
  const jupiterApi = createJupiterApi(env);

  const getQuote = async ({
    inputMint,
    outputMint,
    amount,
    maxAutoSlippageBps,
  }: QuoteParams) => {
    try {
      const quote = await jupiterApi.quoteGet({
        inputMint,
        outputMint,
        amount,
        autoSlippage: true,
        maxAutoSlippageBps: maxAutoSlippageBps
          ? maxAutoSlippageBps * 100
          : undefined,
      });

      if (env.LOG_LEVEL === 'debug') {
        console.log("quote", quote);
      }

      if (!quote) throw new Error("No quote available");
      return quote;
    } catch (error) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  };

  const createSwapTransaction = async (
    quote: any,
    userPublicKey: PublicKey
  ) => {
    try {
      const swapResult = await jupiterApi.instructionsSwapPost({
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: userPublicKey.toBase58(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: Number(env.TIP_AMOUNT) * LAMPORTS_PER_SOL,
        },
      });

      if (!swapResult) throw new Error("Failed to create swap transaction");
      return swapResult;
    } catch (error) {
      throw new Error(`Failed to create swap transaction: ${error.message}`);
    }
  };

  return {
    getQuote,
    createSwapTransaction,
  };
};
