"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Copy, Loader2, Plus, Unplug, WalletIcon } from "lucide-react";
import { HTMLAttributes, useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useDisconnect,
  useWaitForTransactionReceipt,
} from "wagmi";

import { displayAddress } from "@recall/address-utils/display";
import {
  crazyCreditsToCredits,
  creditsToGbMonths,
  creditsToRecall,
  gbMonthsToCredits,
  recallToDisplay,
} from "@recall/bigint-utils/conversions";
import { useBuyCredit, useCreditBalance } from "@recall/sdkx/react/credits";
import { Button } from "@recall/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recall/ui/components/dialog";
import { Input } from "@recall/ui/components/input";
import { Label } from "@recall/ui/components/label";
import { useToast } from "@recall/ui/hooks/use-toast";
import { cn } from "@recall/ui/lib/utils";

type Props = {} & HTMLAttributes<HTMLDivElement>;

export const Wallet = ({ className, ...props }: Props) => {
  const { address, isConnected } = useAccount();
  const {
    data: creditBalance,
    error: creditBalanceError,
    refetch: refetchCreditBalance,
  } = useCreditBalance();
  const balance = useBalance({ address });
  const {
    buyCredit,
    error: buyCreditError,
    isPending: buyCreditPending,
    data: buyCreditTxn,
  } = useBuyCredit();
  const { data: buyCreditReceipt, isPending: buyCreditReceiptIsPending } =
    useWaitForTransactionReceipt({
      hash: buyCreditTxn,
      query: {
        enabled: !!buyCreditTxn,
      },
    });
  const { disconnect } = useDisconnect();
  const [accountOpen, setAccountOpen] = useState(false);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const [displayCredits, setDisplayCredits] = useState("0");
  const { toast } = useToast();

  useEffect(() => {
    if (buyCreditReceipt?.status === "success") {
      refetchCreditBalance();
      setBuyCreditsOpen(false);
    }
  }, [buyCreditReceipt, refetchCreditBalance]);

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

  const handleBuyCredits = async () => {
    buyCredit(recallToSpend);
  };

  const creditPending =
    buyCreditPending || (!!buyCreditTxn && buyCreditReceiptIsPending);

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
          <span>Cost: {recallToSpendDisplay} $RECALL</span>
          <DialogFooter className="">
            <Button onClick={handleBuyCredits} disabled={creditPending}>
              Submit
              {creditPending && <Loader2 className="animate-spin" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
