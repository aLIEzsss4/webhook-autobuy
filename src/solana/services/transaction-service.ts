import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
  Keypair,
} from "@solana/web3.js";
import { createBundleService } from "./bundle-service";

export const createTransactionService = (
  connection: Connection,
  wallet: Keypair,
  bundleService: ReturnType<typeof createBundleService>
) => {
  const deserializeInstruction = (instruction: any): TransactionInstruction => {
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key: any) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
    });
  };

  const getAddressLookupTableAccounts = async (
    keys: string[]
  ): Promise<AddressLookupTableAccount[]> => {
    const accountInfos = await connection.getMultipleAccountsInfo(
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
  };

  const createCombinedTransaction = async (
    swapResult: any,
    parsedAmount: number,
    feePercentage: number,
    feeWallet: PublicKey,
    jitoEnabled: boolean,
    tipAmount: number
  ): Promise<VersionedTransaction> => {
    try {
      const feeAmount = parsedAmount * feePercentage;

      const instructions = [
        ...(swapResult.computeBudgetInstructions || []).map(
          deserializeInstruction
        ),
        ...(swapResult.setupInstructions || []).map(deserializeInstruction),
        deserializeInstruction(swapResult.swapInstruction),
        ...(swapResult.cleanupInstruction
          ? [deserializeInstruction(swapResult.cleanupInstruction)]
          : []),
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: feeWallet,
          lamports: feeAmount,
        }),
      ];

      if (jitoEnabled) {
        const jitoTipAccount = await bundleService.getTipAccount();
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: jitoTipAccount,
            lamports: tipAmount,
          })
        );
      }

      const addressLookupTableAccounts = swapResult.addressLookupTableAddresses
        ? await getAddressLookupTableAccounts(
            swapResult.addressLookupTableAddresses
          )
        : [];

      const { blockhash } = await connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(addressLookupTableAccounts);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([wallet]);

      return transaction;
    } catch (error) {
      throw new Error(
        `Failed to create combined transaction: ${error.message}`
      );
    }
  };

  const sendAndConfirmTransaction = async (
    transaction: VersionedTransaction
  ): Promise<string> => {
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: true,
        maxRetries: 3,
      }
    );

    const confirmation = await connection.confirmTransaction(
      signature,
      "confirmed"
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    return signature;
  };

  return {
    createCombinedTransaction,
    sendAndConfirmTransaction,
  };
};
