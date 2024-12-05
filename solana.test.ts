import { expect, test, describe } from "bun:test";
import { createSolanaService, raydiumSwap } from "./src/solana";
import dotenv from "dotenv";

dotenv.config();

describe("test_raydium_swap", async () => {
  test("test_raydium_swap", async () => {
    const config = {
      rpcUrl: process.env.SOLANA_RPC_URL!,
      privateKey: process.env.SOLANA_PRIVATE_KEY!,
      jitoEnabled: false,
      tipAmount: 0,
      feeAddress: "",
      feePercentage: 0
    };
    
    const payload = {
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: "AkukwSXUTkDSeh2c1ypyvN4unzyr4xb2T4SmKkix6bT8",
      amount: 0.0001,
      maxSlippage: 0.5,
    };
    
    try {
      const txHash = await raydiumSwap(config, payload);
      console.log("Swap transaction hash:", txHash);
      expect(txHash).toBeTruthy();
    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });
}, 50000);
