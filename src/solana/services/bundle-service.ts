import { Connection, PublicKey } from "@solana/web3.js";
import { BundleStatus } from "../types";

export const createBundleService = (jitoConnection: Connection) => {
  const getTipAccount = async (): Promise<PublicKey> => {
    try {
      const response = await fetch(
        `${jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

      const selectedTipAccount =
        tipAccounts[Math.floor(Math.random() * tipAccounts.length)];
      return new PublicKey(selectedTipAccount);
    } catch (error) {
      console.error("Failed to get tip account:", error);
      throw error;
    }
  };

  const simulateBundle = async (transactions: string[]): Promise<void> => {
    try {
      const response = await fetch(
        `${jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
  };

  const sendBundle = async (transactions: string[]): Promise<string> => {
    try {
      console.log("Sending bundle with transactions:", transactions);

      const response = await fetch(
        `${jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendBundle",
            params: [transactions],
          }),
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
  };

  const getBundleStatuses = async (
    bundleIds: string[]
  ): Promise<BundleStatus[]> => {
    try {
      const response = await fetch(
        `${jitoConnection.rpcEndpoint}/api/v1/bundles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
  };

  const pollBundleStatus = async (bundleId: string): Promise<boolean> => {
    const startTime = Date.now();
    const POLL_TIMEOUT_MS = 50000;
    const POLL_INTERVAL_MS = 500;
    let lastStatus = "";

    const wait = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      try {
        const statuses = await getBundleStatuses([bundleId]);
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
  };

  return {
    getTipAccount,
    simulateBundle,
    sendBundle,
    getBundleStatuses,
    pollBundleStatus,
  };
};
