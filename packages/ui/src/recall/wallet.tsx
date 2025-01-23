"use client";

import { HTMLAttributes, useState } from "react";
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
  DialogDescription,
} from "@recall/ui/components/dialog";
import { Label } from "@recall/ui/components/label";
import { Input } from "@recall/ui/components/input";
import { displayAddress } from "@recall/address-utils/display";
import { useToast } from "@recall/ui/hooks/use-toast";
import {
  creditsToRecall,
  recallToDisplay,
  gbMonthsToCredits,
  creditsToGbMonths,
  crazyCreditsToCredits,
} from "@recall/bigint-utils/conversions";
import { useBuyCredit, useCreditBalance } from "@recall/sdkx/react/credits";

type Props = {} & HTMLAttributes<HTMLDivElement>;

export const Wallet = ({ className, ...props }: Props) => {
  const { address } = useAccount();
  const { data: creditBalance, error: creditBalanceError } = useCreditBalance();
  const balance = useBalance({ address });
  const { buyCredit, status, error, isPending } = useBuyCredit();
  const { disconnect } = useDisconnect();
  const [accountOpen, setAccountOpen] = useState(false);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [displayCredits, setDisplayCredits] = useState("0");
  const { toast } = useToast();

  const balanceDisplay = recallToDisplay(balance.data?.value ?? 0n, 2);

  const creditsBalance = crazyCreditsToCredits(creditBalance?.creditFree ?? 0n);
  const gbMonthsBalance = creditsToGbMonths(creditsBalance);

  const creditsToBuy = gbMonthsToCredits(displayCredits || 0);
  const recallToSpend = creditsToRecall(creditsToBuy);
  const recallToSpendDisplay = recallToDisplay(recallToSpend, 4);

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

  const handleBuyCredits = () => {
    buyCredit(recallToSpend);
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
            <span>{balanceDisplay} RECALL</span>
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
      {/* Buy Credits Dialog */}
      <Dialog open={buyCreditsOpen} onOpenChange={setBuyCreditsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Buy Recall Credits</DialogTitle>
            <DialogDescription>
              Credits allow you to store data on the Recall network at a fixed
              rate. One credit stores one GB of data for one month.
            </DialogDescription>
          </DialogHeader>
          <Label>GB Months</Label>
          <Input
            type="number"
            min={1}
            value={displayCredits}
            onChange={(e) => setDisplayCredits(e.target.value)}
          />
          <span>Cost: {recallToSpendDisplay} Recall</span>
          <DialogFooter className="">
            <Button onClick={handleBuyCredits}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="hidden items-center gap-6 lg:flex">
        <span>{balanceDisplay} RECALL</span>
        <div className="flex items-center gap-1">
          <span>{gbMonthsBalance} Credits</span>
          <Plus
            className="opacity-30 hover:cursor-pointer hover:opacity-100"
            onClick={handleOpenBuyCredits}
          />
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
              onClick={
                connected ? () => setAccountOpen(true) : openConnectModal
              }
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
