import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createSwapService } from "./services/swap-service";
import { SolanaConfig, SwapParams, SwapResult } from "./types";

// Re-export types
export * from "./types";

interface Env {
  SOLANA_RPC_URL?: string;
  SOLANA_PRIVATE_KEY?: string;
  JITO_ENABLED?: string;
  TIP_AMOUNT?: string;
  FEE_ADDRESS?: string;
  FEE_PERCENTAGE?: string;
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
  const swapService = createSwapService(config);

  // Return public interface
  return {
    swap: swapService.handleSwap,
  };
};

