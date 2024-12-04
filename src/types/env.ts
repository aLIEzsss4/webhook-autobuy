export interface Env {
  SOLANA_RPC_URL: string;
  SOLANA_PRIVATE_KEY: string;
  JITO_ENABLED: string;
  TIP_AMOUNT: string;
  FEE_ADDRESS: string;
  FEE_PERCENTAGE: string;
  PROXY_URL: string;
  WEBHOOK_SECRET: string;
  ENVIRONMENT: "development" | "production";
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";
}

export const DEFAULT_ENV: Partial<Env> = {
  SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  JITO_ENABLED: "true",
  TIP_AMOUNT: "0.0005",
  FEE_PERCENTAGE: "0.01",
  ENVIRONMENT: "production",
  LOG_LEVEL: "info"
};