"use client";

import { HTMLAttributes } from "react";
import { formatAttoRcl } from "@recall/bigint-utils/format-atto-rcl";
import { Button } from "@recall/ui/components/button";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBalance, useAccount } from "wagmi";
import { PlusIcon } from "lucide-react";
import { cn } from "@recall/ui/lib/utils";

type Props = {} & HTMLAttributes<HTMLDivElement>;

export const Wallet = ({ className, ...props }: Props) => {
  const { address } = useAccount();
  const balance = useBalance({ address });

  return (
    <div
      className={cn("flex flex-row items-center gap-6", className)}
      {...props}
    >
      {balance.data && <span>{formatAttoRcl(balance.data.value)} RCL</span>}
      <div className="flex flex-row items-center gap-1">
        <span>14 Credits</span>
        <PlusIcon className="opacity-30 hover:opacity-100 hover:cursor-pointer" />
      </div>
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          authenticationStatus,
          mounted,
        }) => {
          const connected = mounted && account && chain;
          return (
            <Button
              onClick={connected ? openAccountModal : openConnectModal}
              variant={connected ? "outline" : "default"}
            >
              {connected ? account.displayName : "Connect Wallet"}
            </Button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
};
