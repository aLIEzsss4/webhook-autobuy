import { expect, test, describe } from "bun:test";
import { createSolanaService } from "./src/solana";

describe("test_solana", () => {
  test("test_solana_swap", async () => {
    const swapService = createSolanaService();

    const result = await swapService.swap({
      inputMint: "So11111111111111111111111111111111111111112", // SOL
      outputMint: "9PR7nCP9DpcUotnDPVLUBUZKu5WAYkwrCUx9wDnSpump", // BAN
      amount: 0.001,
    });

    console.log("Swap completed!");
    console.log("Transaction signature:", result);

    expect(result).toBe(200);
  }, 60000);
});
