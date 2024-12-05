import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createSwapService } from "./services/swap-service";
import { SolanaConfig, SwapParams, SwapResult } from "./types";
import { Env } from "../types/env";
import { raydiumSwap } from "./raydium-swap";

// Re-export types
export * from "./types";

export interface RaydiumTradePayload {
  inputMint: string;
  outputMint: string;
  amount: number;
  maxSlippage: number;
}

// Create and configure the Solana service
export const createSolanaService = (env: Env) => {
  // Default configuration
  const config: SolanaConfig = {
    rpcUrl: env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    privateKey: env.SOLANA_PRIVATE_KEY || "",
    jitoEnabled: env.JITO_ENABLED === "true",
    tipAmount: (Number(env.TIP_AMOUNT) || 0.0005) * LAMPORTS_PER_SOL,
    feeAddress: env.FEE_ADDRESS || "",
    feePercentage: Number(env.FEE_PERCENTAGE) || 0.01,
  };

  // Validate required configuration
  if (!config.privateKey) {
    throw new Error("Private key is required");
  }

  // Create the swap service
  const swapService = createSwapService(config, env as Env);

  // Return public interface
  return {
    swap: swapService.handleSwap,
  };
};

export { raydiumSwap };
