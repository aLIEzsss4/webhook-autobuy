import {
  Transaction,
  PublicKey,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import axios, { AxiosResponse } from "axios";
// import { connection, owner } from '../config'

import {
  API_URLS,
  ApiSwapV1Out,
  USDCMint,
  PoolKeys,
  getATAAddress,
  swapBaseInAutoAccount,
  swapBaseOutAutoAccount,
  ALL_PROGRAM_ID,
  printSimulate,
  addComputeBudget,
  parseTokenAccountResp,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import bs58 from "bs58";
import { SolanaConfig, RaydiumTradePayload } from "./types";

const createTransferFeeInstruction = (
  from: PublicKey,
  to: PublicKey,
  lamports: number
) => {
  return SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports });
};

// Add this helper function
const createATAIfNotExists = async (
  connection: Connection,
  owner: Keypair,
  mint: PublicKey
): Promise<PublicKey> => {
  const ata = await getATAAddress(owner.publicKey, mint, TOKEN_PROGRAM_ID);

  try {
    const account = await connection.getAccountInfo(ata.publicKey);
    if (!account) {
      console.log(`Creating ATA for mint ${mint.toString()}`);
      // Add instruction to create ATA if it doesn't exist
      // You'll need to add this to your transaction
    }
    return ata.publicKey;
  } catch (error) {
    console.error("Error checking ATA:", error);
    throw error;
  }
};

// Function to close a token account
function closeTokenAccountInstruction(
  tokenAccount: PublicKey,
  destination: PublicKey,
  owner: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: Buffer.from([9]), // CloseAccount instruction
  });
}

// Function to create an associated token account if it doesn't exist
async function createAssociatedTokenAccountInstruction(
  owner: PublicKey,
  mint: PublicKey,
  connection: Connection
): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
  const ata = await getATAAddress(owner, mint, TOKEN_PROGRAM_ID);
  const accountInfo = await connection.getAccountInfo(ata.publicKey);

  if (accountInfo === null) {
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: ata.publicKey, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: Buffer.alloc(0), // No data is needed for this instruction
    });
    return { address: ata.publicKey, instruction };
  }

  return { address: ata.publicKey, instruction: null };
}

export const raydiumSwap = async (
  config: SolanaConfig,
  payload: RaydiumTradePayload
) => {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const owner: Keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));

  const { inputMint, outputMint, amount: oriAmount, maxSlippage } = payload;

  const amount = oriAmount * LAMPORTS_PER_SOL;
  const slippage = maxSlippage;
  const txVersion: "LEGACY" | "V0" = "V0";

  // const TOKEN_PROGRAM_ID = new PublicKey(
  //   "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  // );

  try {
    // Get all token accounts first
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      owner.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    // For input token
    let inputTokenAcc: PublicKey;
    if (inputMint === NATIVE_MINT.toBase58()) {
      // If input is SOL, create or get wrapped SOL account
      inputTokenAcc = await getATAAddress(
        owner.publicKey,
        NATIVE_MINT,
        TOKEN_PROGRAM_ID
      ).publicKey;
    } else {
      // Find existing token account or create new ATA
      const existingAccount = tokenAccounts.value.find(
        (acc) => acc.account.data.parsed.info.mint === inputMint
      );
      if (existingAccount) {
        inputTokenAcc = existingAccount.pubkey;
      } else {
        inputTokenAcc = await getATAAddress(
          owner.publicKey,
          new PublicKey(inputMint),
          TOKEN_PROGRAM_ID
        ).publicKey;
      }
    }

    // For output token
    let outputTokenAcc: PublicKey;
    if (outputMint === NATIVE_MINT.toBase58()) {
      // If output is SOL, create or get wrapped SOL account
      outputTokenAcc = await getATAAddress(
        owner.publicKey,
        NATIVE_MINT,
        TOKEN_PROGRAM_ID
      ).publicKey;
    } else {
      // Find existing token account or create new ATA
      const existingAccount = tokenAccounts.value.find(
        (acc) => acc.account.data.parsed.info.mint === outputMint
      );
      if (existingAccount) {
        outputTokenAcc = existingAccount.pubkey;
      } else {
        outputTokenAcc = await getATAAddress(
          owner.publicKey,
          new PublicKey(outputMint),
          TOKEN_PROGRAM_ID
        ).publicKey;
      }
    }

    console.log("Token Accounts Info:", {
      isInputSol: inputMint === NATIVE_MINT.toBase58(),
      isOutputSol: outputMint === NATIVE_MINT.toBase58(),
      inputTokenAcc: inputTokenAcc.toString(),
      outputTokenAcc: outputTokenAcc.toString(),
      tokenAccountsCount: tokenAccounts.value.length,
    });

    // Continue with the rest of your swap logic...
    const { data: swapResponse } = await axios.get<ApiSwapV1Out>(
      `${
        API_URLS.SWAP_HOST
      }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${
        slippage * 100
      }&txVersion=${txVersion}`
    );

    console.log(swapResponse, "swapResponse");

    if (!swapResponse.success) {
      throw new Error(`Raydium API Error: ${swapResponse.msg}`);
    }

    const res = await axios.get<AxiosResponse<PoolKeys[]>>(
      API_URLS.BASE_HOST +
        API_URLS.POOL_KEY_BY_ID +
        `?ids=${swapResponse.data.routePlan.map((r) => r.poolId).join(",")}`
    );

    const allMints = res.data.data.map((r) => [r.mintA, r.mintB]).flat();
    const [mintAProgram, mintBProgram] = [
      allMints.find((m) => m.address === inputMint)!.programId,
      allMints.find((m) => m.address === outputMint)!.programId,
    ];

    // get input/output token account ata
    const inputAccount = await getATAAddress(
      owner.publicKey,
      new PublicKey(inputMint),
      TOKEN_PROGRAM_ID
    ).publicKey;
    const outputAccount = await getATAAddress(
      owner.publicKey,
      new PublicKey(outputMint),
      TOKEN_PROGRAM_ID
    ).publicKey;

    const ins = swapBaseInAutoAccount({
      programId: ALL_PROGRAM_ID.Router,
      wallet: owner.publicKey,
      amount: new BN(amount),
      inputAccount,
      outputAccount,
      routeInfo: swapResponse,
      poolKeys: res.data.data,
    });

    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const tx = new Transaction();

    // set up compute units
    const { instructions } = addComputeBudget({
      units: 600000,
      microLamports: 6000000,
    });

    const { address: inputAccount2, instruction: createInputAccountIx } =
      await createAssociatedTokenAccountInstruction(
        owner.publicKey,
        new PublicKey(inputMint),
        connection
      );

    const { address: outputAccount2, instruction: createOutputAccountIx } =
      await createAssociatedTokenAccountInstruction(
        owner.publicKey,
        new PublicKey(outputMint),
        connection
      );

    // Add create account instructions if needed
    if (createInputAccountIx) instructions.push(createInputAccountIx);
    if (createOutputAccountIx) instructions.push(createOutputAccountIx);


    const isInputSol = inputMint === NATIVE_MINT.toBase58();

    if (isInputSol) {
      const createWrappedSolInst = SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: inputTokenAcc,
        lamports: amount,
      });

      const syncWrappedInst = new TransactionInstruction({
        keys: [{ pubkey: inputTokenAcc, isSigner: false, isWritable: true }],
        programId: TOKEN_PROGRAM_ID,
        data: Buffer.from([17]), // SyncNative instruction
      });

      instructions.push(createWrappedSolInst);
      instructions.push(syncWrappedInst);
    }

    instructions.forEach((ins) => tx.add(ins));

    tx.add(ins);

    const closeAccountIx = closeTokenAccountInstruction(
      inputTokenAcc,
      owner.publicKey,
      owner.publicKey
    );
    tx.add(closeAccountIx);

    const transferFeeIx = createTransferFeeInstruction(
      owner.publicKey,
      new PublicKey(config.feeAddress), // fee wallet
      config.feePercentage * amount // fee amount
    );
    tx.add(transferFeeIx);

    tx.feePayer = owner.publicKey;
    tx.recentBlockhash = recentBlockhash;
    tx.sign(owner);


    printSimulate([tx]);
    console.log("Account Details:", {
      inputAccount: inputAccount.toString(),
      outputAccount: outputAccount.toString(),
      mintAProgram: mintAProgram.toString(),
      mintBProgram: mintBProgram.toString(),
      ownerPublicKey: owner.publicKey.toString(),
    });

    // Simulate the transaction first
    const simulation = await connection.simulateTransaction(tx);
    if (simulation.value.err) {
      console.error("Simulation error:", simulation.value);
      throw new Error(
        `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
      );
    }

    // If simulation succeeds, send the transaction
    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    return txHash;
  } catch (error) {
    console.error("Raydium swap error:", error);
    throw error;
  }
};
