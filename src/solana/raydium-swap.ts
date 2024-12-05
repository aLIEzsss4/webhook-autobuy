import {
  Transaction,
  PublicKey,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
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
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import bs58 from "bs58";
import { SolanaConfig, RaydiumTradePayload } from "./types";

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


  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

  try {
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
    ]


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
    instructions.forEach((ins) => tx.add(ins));

    tx.add(ins);
    tx.feePayer = owner.publicKey;
    tx.recentBlockhash = recentBlockhash;
    tx.sign(owner);

    printSimulate([tx])
    
    console.log(ins, "ins")

    console.log("Account Details:", {
      inputAccount: inputAccount.toString(),
      outputAccount: outputAccount.toString(),
      mintAProgram: mintAProgram.toString(),
      mintBProgram: mintBProgram.toString(),
      ownerPublicKey: owner.publicKey.toString()
    });

    // Simulate the transaction first
    const simulation = await connection.simulateTransaction(tx);
    if (simulation.value.err) {
      console.error("Simulation error:", simulation.value);
      throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
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
