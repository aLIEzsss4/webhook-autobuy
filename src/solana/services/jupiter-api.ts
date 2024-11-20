import {
  createJupiterApiClient,
  QuoteGetRequest,
  SwapPostRequest,
} from "@jup-ag/api";
import dotenv from "dotenv";

dotenv.config();

export interface JupiterTokenPriceData {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

interface JupiterPriceApiResponse {
  data: Record;
  timeTaken: number;
}

export interface JupiterTokenMetadata {
  address: string;
  chainId: number;
  decimals: number;
  name?: string;
  symbol?: string;
  logoURI: string;
  tags: string[];
}

const proxyUrl = process.env.PROXY_URL;

export const createJupiterApi = () => {
  const jupiterApi = createJupiterApiClient();

  const getTokenPricesInUsdc = async (tokenIds: string[]) => {
    if (tokenIds.length === 0) {
      return {};
    }
    const url = `https://price.jup.ag/v4/price?ids=${tokenIds.join(
      ","
    )}&vsToken=USDC`;
    const response = await fetch(url);
    const parsedResponse = (await response.json()) as JupiterPriceApiResponse;
    return parsedResponse.data;
  };

  const getTokenPriceInSol = async (tokenIds: string[]) => {
    if (tokenIds.length === 0) {
      return {};
    }
    const url = `https://price.jup.ag/v4/price?ids=${tokenIds.join(
      ","
    )}&vsToken=SOL`;
    const response = await fetch(url);
    const parsedResponse = (await response.json()) as JupiterPriceApiResponse;
    return parsedResponse.data;
  };

  const quoteGet = async (request: QuoteGetRequest) => {
    console.log(request);

    const { inputMint, outputMint, amount, slippageBps } = request;
    const url = `${proxyUrl}https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`;
    console.log("quoteGet url", url);

    const quoteResponse = await (await fetch(url)).json();

    return quoteResponse;
    // return await jupiterApi.quoteGet(request);
  };

  const swapPost = async (request: SwapPostRequest) => {
    return await jupiterApi.swapPost(request);
  };

  const instructionsSwapPost = async (request: SwapPostRequest) => {
    return await jupiterApi.swapInstructionsPost(request);
  };

  const getTokenList = async (): Promise<any[]> => {
    try {
      const response = await fetch("https://token.jup.ag/all");

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const getStrictList = async (): Promise<any[]> => {
    try {
      const response = await fetch(
        proxyUrl + `https://tokens.jup.ag/tokens?tags=verified`
      );

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const getTokenInfoByAddress = async (
    tokenAddress: string
  ): Promise<any[]> => {
    try {
      const response = await fetch(
        proxyUrl +
          `https://api.dexscreener.com/latest/dex/search?q=${tokenAddress}`
      );

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const lookupToken = async (token: string | null): Promise<any | null> => {
    if (!token) {
      return null;
    }
    const tokenLowercase = token.toLowerCase().trim();
    const jupiterTokenMetadata = await getStrictList();

    const jupTokenMetaDatum = jupiterTokenMetadata.find(
      (token) =>
        token.symbol?.toLowerCase() === tokenLowercase ||
        token.address?.toLowerCase() === tokenLowercase
    );

    return jupTokenMetaDatum ?? null;
  };

  return {
    getTokenPricesInUsdc,
    getTokenPriceInSol,
    quoteGet,
    swapPost,
    lookupToken,
    getTokenInfoByAddress,
    instructionsSwapPost,
  };
};

const jupiterApi = createJupiterApi();

export default jupiterApi;
