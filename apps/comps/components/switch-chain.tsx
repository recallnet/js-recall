"use client";

import { useWallets } from "@privy-io/react-auth";
import { ArrowUpDown } from "lucide-react";
import React, { useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

interface SwitchChainProps {
  chainId: number;
}

export const SwitchChain: React.FunctionComponent<SwitchChainProps> = ({
  chainId,
}) => {
  const { wallets } = useWallets();
  const { connector } = useAccount();
  const [isPending, setIsPending] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const handleSwitchChain = async (targetChainId: number) => {
    console.log("Attempting to switch to chain ID:", targetChainId);
    setLastError(null);
    setIsPending(true);

    try {
      // Try to find the active wallet from Privy
      const activeWallet = wallets.find(
        (w) => w.walletClientType !== "privy" && w.address,
      );

      if (activeWallet) {
        console.log("Using Privy wallet to switch chain:", {
          walletType: activeWallet.walletClientType,
          address: activeWallet.address,
          targetChainId,
        });

        // Use Privy's wallet switchChain method
        await activeWallet.switchChain(targetChainId);
        console.log("Successfully switched to chain:", targetChainId);
        setLastError(null);
      } else if (connector) {
        // Fallback to using the connector directly
        console.log("Using connector to switch chain");
        const provider = (await connector.getProvider()) as {
          request: (args: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
        };

        // Request wallet to switch chain using EIP-3326
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });
        console.log("Successfully switched chain via provider");
        setLastError(null);
      } else {
        throw new Error("No wallet or connector available to switch chains");
      }
    } catch (err) {
      console.error("Failed to switch chain:", {
        error: err,
        targetChainId,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      setLastError(
        err instanceof Error ? err : new Error("Failed to switch network"),
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => {
          handleSwitchChain(chainId);
        }}
        variant="default"
        disabled={isPending}
        className={cn(
          "h-14 rounded-none px-6 font-mono text-xs font-medium uppercase tracking-widest",
          isPending && "cursor-not-allowed opacity-50",
        )}
      >
        <ArrowUpDown className="mr-2 h-4 w-4" />
        {isPending ? "Switching..." : `Switch Network`}
      </Button>
      {lastError && (
        <p className="text-sm text-red-400">
          {lastError.message || "Failed to switch network. Please try again."}
        </p>
      )}
    </div>
  );
};
