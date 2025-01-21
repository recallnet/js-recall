"use client";

import { HTMLAttributes, useState } from "react";
import { formatAttoRcl } from "@recall/bigint-utils/format-atto-rcl";
import { Button } from "@recall/ui/components/button";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBalance, useAccount, useDisconnect } from "wagmi";
import { Plus, Copy, Unplug } from "lucide-react";
import { cn } from "@recall/ui/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@recall/ui/components/dialog";
import { displayAddress } from "@recall/address-utils/display";
import { useToast } from "@recall/ui/hooks/use-toast";

type Props = {} & HTMLAttributes<HTMLDivElement>;

export const Wallet = ({ className, ...props }: Props) => {
  const { address } = useAccount();
  const balance = useBalance({ address });
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(address ?? "");
    toast({
      title: "Address Copied!",
    });
    setOpen(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setOpen(false);
  };

  return (
    <div
      className={cn("flex flex-none flex-row items-center gap-6", className)}
      {...props}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            {address && <DialogTitle>{displayAddress(address)}</DialogTitle>}
          </DialogHeader>
          <div className="flex items-center justify-center gap-6 lg:flex">
            {balance.data && (
              <span>{formatAttoRcl(balance.data.value)} RECALL</span>
            )}
            <div className="flex items-center gap-1">
              <span>14 Credits</span>
              <Plus className="opacity-30 hover:cursor-pointer hover:opacity-100" />
            </div>
          </div>
          <DialogFooter className="gap-y-2 sm:justify-center">
            <Button variant="secondary" onClick={handleCopyAddress}>
              Copy Address
              <Copy />
            </Button>
            <Button variant="secondary" onClick={handleDisconnect}>
              Disconnect
              <Unplug />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="hidden items-center gap-6 lg:flex">
        {balance.data && (
          <span>{formatAttoRcl(balance.data.value)} RECALL</span>
        )}
        <div className="flex items-center gap-1">
          <span>14 Credits</span>
          <Plus className="opacity-30 hover:cursor-pointer hover:opacity-100" />
        </div>
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
              onClick={connected ? () => setOpen(true) : openConnectModal}
              variant={connected ? "outline" : "default"}
            >
              {connected ? displayAddress(account.address) : "Connect Wallet"}
            </Button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
};
