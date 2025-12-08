"use client";

import { Wallet } from "lucide-react";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { useSession } from "@/hooks/useSession";

export const ConnectWallet: React.FunctionComponent = () => {
  const { linkOrConnectWallet } = useSession();

  const handleConnectWallet = () => {
    linkOrConnectWallet();
  };

  return (
    <Button
      onClick={handleConnectWallet}
      variant="default"
      className={cn(
        "h-14 rounded-none px-6 font-mono text-xs font-medium uppercase tracking-widest",
      )}
    >
      <Wallet className="h-4 w-4 md:mr-2" />
      <span className="hidden md:inline">Connect Wallet</span>
    </Button>
  );
};
