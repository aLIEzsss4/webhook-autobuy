import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { SolanaConfig, SwapParams, SwapResult } from "../types";
import { createTransactionService } from "./transaction-service";
import { createBundleService } from "./bundle-service";
import { createQuoteService } from "./quote-service";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import bs58 from "bs58";
import { Env } from "../../types/env";

export const createSwapService = (config: SolanaConfig, env: Env) => {
  // Initialize base connections and wallet
  const connection = new Connection(config.rpcUrl, "confirmed");
  const wallet = getKeypairFromEnvironment("SOLANA_PRIVATE_KEY");
  const feeWallet = new PublicKey(config.feeAddress);
  const jitoConnection = new Connection(
    "https://tokyo.mainnet.block-engine.jito.wtf",
    "confirmed"
  );

  const quoteService = createQuoteService(env);
  // Initialize sub-services
  const bundleService = createBundleService(jitoConnection);
  const transactionService = createTransactionService(
    connection,
    wallet,
    bundleService
  );

  const SOL_MINT = "So11111111111111111111111111111111111111112";

  const getParsedAmount = async (mint: string, amount: number) => {
    if (mint === SOL_MINT) {
      return amount * LAMPORTS_PER_SOL;
    } else {
      const mintInfo = await connection.getTokenAccountBalance(
        new PublicKey(mint)
      );
      const { decimals } = mintInfo.value;
      return amount * 10 ** decimals;
    }
  };

  const handleSwap = async ({
    inputMint,
    outputMint,
    amount,
    maxAutoSlippageBps,
  }: SwapParams): Promise<SwapResult> => {
    try {
      const start = Date.now();
      console.log("Starting swap process...");
      console.log(`Using Wallet: ${wallet.publicKey.toBase58()}`);

      // Convert amount to lamports
      let parsedAmount = await getParsedAmount(inputMint, amount);

      // Get quote
      const quote = await quoteService.getQuote({
        inputMint,
        outputMint,
        amount: parsedAmount,
        maxAutoSlippageBps,
      });

      // Create swap transaction
      const swapResult = await quoteService.createSwapTransaction(
        quote,
        wallet.publicKey
      );

      // Create combined transaction
      const combinedTx = await transactionService.createCombinedTransaction(
        swapResult,
        parsedAmount,
        config.feePercentage,
        feeWallet,
        config.jitoEnabled,
        config.tipAmount
      );

      // Handle Jito MEV bundles if enabled
      if (config.jitoEnabled) {
        const serializedTx = combinedTx.serialize();
        const b58Tx = bs58.encode(serializedTx);

        // Simulate bundle before sending
        // await bundleService.simulateBundle([b58Tx]);

        // Send bundle
        const bundleId = await bundleService.sendBundle([b58Tx]);
        console.log("Bundle sent with ID:", bundleId);
        const end = Date.now();
        console.log(`Total duration: ${end - start}ms`);

        // Poll for bundle status
        await bundleService.pollBundleStatus(bundleId);

        return {
          bundleId,
          quote,
          walletAddress: wallet.publicKey.toBase58(),
        };
      }

      // Regular transaction flow
      const signature = await transactionService.sendAndConfirmTransaction(
        combinedTx
      );

      const end = Date.now();
      console.log(`Transaction confirmed: ${signature}`);
      console.log(`https://solscan.io/tx/${signature}`);
      console.log(`Total duration: ${end - start}ms`);

      return {
        signature,
        quote,
        walletAddress: wallet.publicKey.toBase58(),
      };
    } catch (error) {
      console.error("Swap error:", error);
      throw handleError(error);
    }
  };

  const handleError = (error: any): Error => {
    if (error.message.includes("insufficient funds")) {
      return new Error("Insufficient funds for transaction");
    }
    if (error.message.includes("Invalid quote")) {
      return new Error("Invalid swap quote received");
    }
    return new Error(`Swap failed: ${error.message}`);
  };

  return {
    handleSwap,
  };
};
