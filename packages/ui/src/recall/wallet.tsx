"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Copy, Plus, Unplug, WalletIcon } from "lucide-react";
import { HTMLAttributes, useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useConfig,
  useDisconnect,
  useSwitchChain,
} from "wagmi";

import { displayAddress } from "@recallnet/address-utils/display";
import {
  attoCreditsToGbMonths,
  attoRecallToRecallDisplay,
} from "@recallnet/bigint-utils/conversions";
import { useCreditAccount } from "@recallnet/sdkx/react/credits";
import { Button } from "@recallnet/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/dialog";
import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";
import BuyCreditsDialog from "@recallnet/ui/recall/buy-credits-dialog";

type Props = {} & HTMLAttributes<HTMLDivElement>;

export const Wallet = ({ className, ...props }: Props) => {
  const { address } = useAccount();

  const { data: creditAccount, error: creditAccountError } = useCreditAccount();

  const balance = useBalance({ address });

  const { disconnect } = useDisconnect();

  const [accountOpen, setAccountOpen] = useState(false);

  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  const { toast } = useToast();

  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const config = useConfig();

  useEffect(() => {
    if (chainId && chainId !== config.chains[0].id) {
      switchChain({
        chainId: config.chains[0].id,
      });
    }
  }, [switchChain, chainId, config]);

  useEffect(() => {
    if (creditAccountError) {
      toast({
        title: "Error fetching credit account",
        description: creditAccountError.message,
      });
    }
  }, [creditAccountError, toast]);

  const balanceDisplay = attoRecallToRecallDisplay(
    balance.data?.value ?? 0n,
    2,
  );

  const gbMonthsBalance = attoCreditsToGbMonths(
    creditAccount?.creditFree ?? 0n,
  );

  const handleOpenBuyCredits = async () => {
    if (accountOpen) {
      setAccountOpen(false);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    setBuyCreditsOpen(true);
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(address ?? "");
    toast({
      title: "Address Copied!",
    });
    setAccountOpen(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setAccountOpen(false);
  };

  return (
    <div
      className={cn("flex flex-none flex-row items-center gap-6", className)}
      {...props}
    >
      {/* Account Dialog */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            {address && <DialogTitle>{displayAddress(address)}</DialogTitle>}
          </DialogHeader>
          <div className="flex items-center justify-center gap-6 lg:flex">
            <span>{balanceDisplay} $RECALL</span>
            <div className="flex items-center gap-1">
              <span>{gbMonthsBalance} Credits</span>
              <Plus
                className="opacity-30 hover:cursor-pointer hover:opacity-100"
                onClick={handleOpenBuyCredits}
              />
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
      <BuyCreditsDialog open={buyCreditsOpen} setOpen={setBuyCreditsOpen} />
      <ConnectButton.Custom>
        {/* eslint-disable @typescript-eslint/ban-ts-comment */}
        {({
          // @ts-ignore
          account,
          // @ts-ignore
          chain,
          // @ts-ignore
          openConnectModal,
          // @ts-ignore
          mounted,
        }) => {
          const connected = mounted && account && chain;
          return (
            <Button
              onClick={
                connected ? () => setAccountOpen(true) : openConnectModal
              }
              variant={connected ? "outline" : "default"}
            >
              <WalletIcon />
              <span className="hidden md:block">
                {connected ? displayAddress(account.address) : "Connect Wallet"}
              </span>
            </Button>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
};
