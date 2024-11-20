import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createSwapService } from "./services/swap-service";
import { SolanaConfig, SwapParams, SwapResult } from "./types";

// Re-export types
export * from "./types";

// Create and configure the Solana service
export const createSolanaService = () => {
  // Default configuration
  const config: SolanaConfig = {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    privateKey: process.env.SOLANA_PRIVATE_KEY || "",
    jitoEnabled: process.env.JITO_ENABLED === "true",
    tipAmount: (Number(process.env.TIP_AMOUNT) || 0.0005) * LAMPORTS_PER_SOL,
    feeAddress: process.env.FEE_ADDRESS || "",
    feePercentage: Number(process.env.FEE_PERCENTAGE) || 0.01,
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

