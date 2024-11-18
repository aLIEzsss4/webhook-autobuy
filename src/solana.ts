import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import jupiterApi from "./utils/jupiter-api";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import { parseUnits } from "viem";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  amountDecimal: number;
  maxAutoSlippageBps?: number;
}

interface BundleStatus {
  status: string;
  landed_slot?: number;
  error?: string;
}

export default class SolanaSwapService {
  private connection: Connection;
  private wallet: any;
  private tipAmount: number;
  private isJitoTipEnabled: boolean;
  private jitoConnection: Connection;
  private readonly FEE_PERCENTAGE = 0.01;
  private readonly FEE_WALLET: PublicKey;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
    this.wallet = getKeypairFromEnvironment("SOLANA_PRIVATE_KEY");
    this.tipAmount = 0.0005 * LAMPORTS_PER_SOL;
    this.isJitoTipEnabled = true;
    this.FEE_WALLET = new PublicKey(process.env.FEE_ADDRESS!);
    this.jitoConnection = new Connection(
      "https://tokyo.mainnet.block-engine.jito.wtf",
      "confirmed"
    );
  }

  async handleSwap({
    inputMint,
    outputMint,
    amount,
    amountDecimal,
    maxAutoSlippageBps,
  }: SwapParams) {
    try {
      const start = Date.now();
      console.log("Starting swap process...");
      console.log(`Using Wallet: ${this.wallet.publicKey.toBase58()}`);

      const parsedAmount = this.parseAmount(amount, amountDecimal);
      const quote = await this.getQuote({
        inputMint,
        outputMint,
        amount: parsedAmount,
        maxAutoSlippageBps,
      });

      // Get swap transaction without sending
      const swapResult = await this.createSwapTransaction(quote);

      // Create a single transaction combining swap, fees, and tips
      const combinedTx = await this.createCombinedTransaction(
        swapResult,
        parsedAmount
      );

      // Simulate bundle before sending
      const serializedTx = combinedTx.serialize();
      // await this.simulateBundle([Buffer.from(serializedTx).toString('base64')]);

      const b58Tx = bs58.encode(serializedTx);
      console.log("Transaction encoded:", b58Tx);

      if (this.isJitoTipEnabled) {
        // Send bundle
        const bundleId = await this.sendBundle([b58Tx]);
        console.log("Bundle sent with ID:", bundleId);

        // // Poll for bundle status
        await this.pollBundleStatus(bundleId);

        return {
          signature: "",
          bundleId,
          quote,
          walletAddress: this.wallet.publicKey.toBase58(),
        };
      } else {
        const signature = await this.connection.sendRawTransaction(
          serializedTx,
          {
            skipPreflight: true,
            maxRetries: 3,
          }
        );
        const end = Date.now();
        console.log("Sending transaction... signature", signature);
        // Wait for confirmation and handle response
        console.log("Waiting for confirmation...");
        const confirmation = await this.connection.confirmTransaction(
          signature,
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        console.log(`Transaction confirmed: ${signature}`);
        console.log(`https://solscan.io/tx/${signature}`);
        console.log(`Total duration: ${end - start}ms`);

        return {
          signature,
          quote,
          walletAddress: this.wallet.publicKey.toBase58(),
        };
      }
    } catch (error) {
      console.error("Swap error:", error);
      throw this.handleError(error);
    }
  }

  private async createCombinedTransaction(
    swapResult: any,
    parsedAmount: number
  ): Promise<VersionedTransaction> {
    try {
      const feeAmount = parsedAmount * this.FEE_PERCENTAGE;
      const { blockhash } = await this.connection.getLatestBlockhash();

      const instructions = [
        ...(swapResult.computeBudgetInstructions || []).map(
          this.deserializeInstruction
        ),
        ...(swapResult.setupInstructions || []).map(
          this.deserializeInstruction
        ),
        this.deserializeInstruction(swapResult.swapInstruction),
        ...(swapResult.cleanupInstruction
          ? [this.deserializeInstruction(swapResult.cleanupInstruction)]
          : []),
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.FEE_WALLET,
          lamports: feeAmount,
        }),
      ];

      if (this.isJitoTipEnabled) {
        const jitoTipAccount = await this.getTipAccount();
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: this.wallet.publicKey,
            toPubkey: jitoTipAccount,
            lamports: this.tipAmount,
          })
        );
      }

      const addressLookupTableAccounts = swapResult.addressLookupTableAddresses
        ? await this.getAddressLookupTableAccounts(
            swapResult.addressLookupTableAddresses
          )
        : [];

      const messageV0 = new TransactionMessage({
        payerKey: this.wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(addressLookupTableAccounts);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([this.wallet]);

      return transaction;
    } catch (error) {
      throw new Error(
        `Failed to create combined transaction: ${error.message}`
      );
    }
  }

  private deserializeInstruction(instruction: any): TransactionInstruction {
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key: any) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
    });
  }

  private async getAddressLookupTableAccounts(
    keys: string[]
  ): Promise<AddressLookupTableAccount[]> {
    const accountInfos = await this.connection.getMultipleAccountsInfo(
      keys.map((key) => new PublicKey(key))
    );

    return accountInfos.reduce((acc, accountInfo, index) => {
      if (accountInfo) {
        acc.push(
          new AddressLookupTableAccount({
            key: new PublicKey(keys[index]),
            state: AddressLookupTableAccount.deserialize(accountInfo.data),
          })
        );
      }
      return acc;
    }, [] as AddressLookupTableAccount[]);
  }

  private async getTipAccount(): Promise<PublicKey> {
    try {
      const response = await fetch(
        `${this.jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTipAccounts",
            params: [],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tip accounts: ${response.statusText}`);
      }

      const { result: tipAccounts } = await response.json();

      if (!tipAccounts || !tipAccounts.length) {
        throw new Error("No tip accounts available");
      }

      // Randomly select one tip account from the list
      const selectedTipAccount =
        tipAccounts[Math.floor(Math.random() * tipAccounts.length)];
      return new PublicKey(selectedTipAccount);
    } catch (error) {
      console.error("Failed to get tip account:", error);
      throw error;
    }
  }

  private parseAmount(amount: number, amountDecimal: number): number {
    return Number(parseUnits(amount.toString(), amountDecimal));
  }

  private async getQuote({
    inputMint,
    outputMint,
    amount,
    maxAutoSlippageBps,
  }: Omit<SwapParams, "amountDecimal">) {
    try {
      const quote = await jupiterApi.quoteGet({
        inputMint,
        outputMint,
        amount,
        autoSlippage: true,
        maxAutoSlippageBps: maxAutoSlippageBps * 100,
      });
      console.log("quote", quote);

      if (!quote) throw new Error("No quote available");
      return quote;
    } catch (error) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  private async createSwapTransaction(quote: any) {
    try {
      const swapResult = await jupiterApi.instructionsSwapPost({
        swapRequest: {
          quoteResponse: quote,
          userPublicKey: this.wallet.publicKey.toBase58(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 0.0005 * LAMPORTS_PER_SOL,
        },
      });

      if (!swapResult) throw new Error("Failed to create swap transaction");
      // console.log(swapResult, "swapResult");
      return swapResult;
    } catch (error) {
      throw new Error(`Failed to create swap transaction: ${error.message}`);
    }
  }

  private convertBase64ToBase58(base64: string): string {
    const buffer = Buffer.from(base64, "base64");
    return bs58.encode(buffer);
  }

  private async simulateBundle(transactions: string[]): Promise<void> {
    try {
      const response = await fetch(
        `${this.jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "simulateBundle",
            params: [transactions],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Bundle simulation response:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Failed to simulate bundle: ${errorText}`);
      }

      const result = await response.json();
      console.log("Bundle simulation result:", result);

      if (result.error) {
        throw new Error(
          `Bundle simulation failed: ${JSON.stringify(result.error)}`
        );
      }
    } catch (error) {
      console.error("Bundle simulation failed:", error);
      throw error;
    }
  }

  private async sendBundle(transactions: string[]): Promise<string> {
    try {
      console.log("Sending bundle with transactions:", transactions);

      const bundle = {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [transactions],
      };

      const response = await fetch(
        `${this.jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bundle),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send bundle: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Bundle send response:", data);

      if (data.error) {
        throw new Error(`Failed to send bundle: ${JSON.stringify(data.error)}`);
      }

      return data.result;
    } catch (error) {
      console.error("Failed to send bundle:", error);
      throw error;
    }
  }

  private async getBundleStatuses(
    bundleIds: string[]
  ): Promise<BundleStatus[]> {
    try {
      const response = await fetch(
        `${this.jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getInflightBundleStatuses",
            params: [bundleIds],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log("Bundle status response:", data);

      if (data.error) {
        throw new Error(`API error: ${JSON.stringify(data.error)}`);
      }

      if (!data.result?.value) {
        console.warn("No bundle status found, returning empty array");
        return [];
      }

      return data.result.value;
    } catch (error) {
      console.error("Failed to get bundle statuses:", error);
      throw error;
    }
  }

  async pollBundleStatus(bundleId: string): Promise<boolean> {
    const startTime = Date.now();
    const POLL_TIMEOUT_MS = 50000;
    const POLL_INTERVAL_MS = 500;
    let lastStatus = "";

    const wait = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      try {
        const statuses = await this.getBundleStatuses([bundleId]);

        console.log("Received bundle statuses:", statuses);

        if (!statuses || statuses.length === 0) {
          console.log("No status returned, waiting...");
          await wait(POLL_INTERVAL_MS);
          continue;
        }

        const status = statuses[0]?.status;

        if (status !== lastStatus) {
          lastStatus = status;
          console.log(`Bundle ${bundleId} status: ${status}`);
        }

        switch (status) {
          case "Landed":
            console.log(`Bundle landed at slot: ${statuses[0].landed_slot}`);
            return true;
          case "Failed":
            throw new Error(
              `Bundle failed: ${statuses[0].error || "Unknown error"}`
            );
          case "Pending":
          case "Processed":
            await wait(POLL_INTERVAL_MS);
            continue;
          default:
            console.warn(`Unknown bundle status: ${status}`);
            await wait(POLL_INTERVAL_MS);
        }
      } catch (error) {
        console.error("Error polling bundle status:", error);

        if (Date.now() - startTime >= POLL_TIMEOUT_MS) {
          throw new Error(`Bundle polling timeout after ${POLL_TIMEOUT_MS}ms`);
        }

        await wait(POLL_INTERVAL_MS);
      }
    }

    throw new Error(
      `Bundle polling timeout after ${POLL_TIMEOUT_MS}ms without confirmation`
    );
  }

  private handleError(error: any): Error {
    if (error.message.includes("insufficient funds")) {
      return new Error("Insufficient funds for transaction");
    }
    if (error.message.includes("Invalid quote")) {
      return new Error("Invalid swap quote received");
    }
    return new Error(`Swap failed: ${error.message}`);
  }
}
