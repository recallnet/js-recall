"use client";

import { ArrowUpDown } from "lucide-react";
import React from "react";
import { useSwitchChain } from "wagmi";

import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

interface SwitchChainProps {
  chainId: number;
}

export const SwitchChain: React.FunctionComponent<SwitchChainProps> = ({
  chainId,
}) => {
  const { switchChain, isPending } = useSwitchChain();

  const handleSwitchChain = (targetChainId: number) => {
    switchChain({ chainId: targetChainId });
  };

  return (
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
  );
};
