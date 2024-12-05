import { PublicKey } from "@solana/web3.js";

export interface SolanaConfig {
  rpcUrl: string;
  privateKey: string;
  jitoEnabled: boolean;
  tipAmount: number;
  feeAddress: string;
  feePercentage: number;
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  maxAutoSlippageBps?: number;
}

export interface BundleStatus {
  status: string;
  landed_slot?: number;
  error?: string;
}

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  maxAutoSlippageBps?: number;
}

export interface SwapResult {
  signature?: string;
  bundleId?: string;
  quote: any;
  walletAddress: string;
}

export interface RaydiumTradePayload {
  inputMint: string;
  outputMint: string;
  amount: number;
  maxSlippage: number;
}
