import { Chain } from "viem";
import { Token } from "./index";

export async function handleEVMTransaction(token: Token) {
  try {
    console.log(`start ${token.chain} transaction:`);
    console.log(`- address: ${token.address}`);
    console.log(`- name: ${token.name}`);
  } catch (error) {
    console.error(`error:`, error);
    throw error;
  }
}
