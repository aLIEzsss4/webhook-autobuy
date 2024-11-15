import { Token } from "./index";

export async function handleSolanaTransaction(token: Token) {
  console.log(`handleSolanaTransaction: ${token.address}`);
}
