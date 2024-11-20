
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import jupiterApi from "./jupiter-api";
import { QuoteParams } from "../types";

export const createQuoteService = () => {
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
      console.log("quote", quote);

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
          prioritizationFeeLamports: 0.0005 * LAMPORTS_PER_SOL,
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
