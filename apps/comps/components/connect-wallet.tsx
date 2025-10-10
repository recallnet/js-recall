"use client";

import { useConnectWallet } from "@privy-io/react-auth";
import { Wallet } from "lucide-react";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

export const ConnectWallet: React.FunctionComponent = () => {
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      console.log("Wallet connected successfully:", wallet);
    },
    onError: (error) => {
      console.error("Failed to connect wallet:", error);
    },
  });

  const handleConnectWallet = () => {
    connectWallet();
  };

  return (
    <Button
      onClick={handleConnectWallet}
      variant="default"
      className={cn(
        "h-14 rounded-none px-6 font-mono text-xs font-medium uppercase tracking-widest",
      )}
    >
      <Wallet className="mr-2 h-4 w-4" />
      Connect Wallet
    </Button>
  );
};
