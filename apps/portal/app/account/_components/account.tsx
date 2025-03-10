"use client";

import { CreditCard, Database, DollarSign, Loader2 } from "lucide-react";
import { duration } from "moment";
import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { useAccount, useBalance, useWaitForTransactionReceipt } from "wagmi";

import { displayAddress } from "@recallnet/address-utils/display";
import {
  attoCreditsToGbMonths,
  attoRecallToRecallDisplay,
  numBlocksToSeconds,
} from "@recallnet/bigint-utils/conversions";
import {
  useCreditAccount,
  useDeleteAccountSponsor,
  useSetAccountSponsor,
} from "@recallnet/sdkx/react/credits";
import { Button } from "@recallnet/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/dialog";
import { Input } from "@recallnet/ui/components/input";
import { Label } from "@recallnet/ui/components/label";
import { useToast } from "@recallnet/ui/hooks/use-toast";
import BuyCreditsDialog from "@recallnet/ui/recall/buy-credits-dialog";

import Metric from "@/components/metric";
import { formatBytes } from "@/lib/format-bytes";

export function Account() {
  const { toast } = useToast();

  const { address } = useAccount();

  const { data } = useBalance({ address });

  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  const [setSponsorOpen, setSetSponsorOpen] = useState(false);

  const [sponsorAddress, setSponsorAddress] = useState("");

  const {
    data: creditAccount,
    error: creditAccountError,
    refetch: refetchCreditAccount,
  } = useCreditAccount();

  const {
    setAccountSponsor,
    isPending: setSponsorPending,
    data: setSponsorTxnHash,
    error: setSponsorError,
  } = useSetAccountSponsor();

  const {
    isPending: setSponsorReceiptPending,
    isSuccess: setSponsorReceiptSuccess,
    error: setSponsorReceiptError,
  } = useWaitForTransactionReceipt({
    hash: setSponsorTxnHash,
  });

  const {
    deleteAccountSponsor,
    isPending: deleteSponsorPending,
    data: deleteSponsorTxnHash,
    error: deleteSponsorError,
  } = useDeleteAccountSponsor();

  const {
    isPending: deleteSponsorReceiptPending,
    isSuccess: deleteSponsorReceiptSuccess,
    error: deleteSponsorReceiptError,
  } = useWaitForTransactionReceipt({
    hash: deleteSponsorTxnHash,
  });

  useEffect(() => {
    if (setSponsorReceiptSuccess || deleteSponsorReceiptSuccess) {
      refetchCreditAccount();
      setSetSponsorOpen(false);
    }
  }, [
    setSponsorReceiptSuccess,
    deleteSponsorReceiptSuccess,
    refetchCreditAccount,
  ]);

  useEffect(() => {
    if (
      creditAccountError ||
      setSponsorError ||
      setSponsorReceiptError ||
      deleteSponsorError ||
      deleteSponsorReceiptError
    ) {
      toast({
        title: "Error",
        description:
          creditAccountError?.message ||
          setSponsorError?.message ||
          setSponsorReceiptError?.message ||
          deleteSponsorError?.message ||
          deleteSponsorReceiptError?.message,
        variant: "destructive",
      });
    }
  }, [
    creditAccountError,
    setSponsorError,
    setSponsorReceiptError,
    deleteSponsorError,
    deleteSponsorReceiptError,
    toast,
  ]);

  const handleSetSponsor = () => {
    if (!address || !sponsorAddress) return;
    if (!isAddress(sponsorAddress)) {
      toast({
        title: "Invalid address",
        description: "Please enter a valid address",
        variant: "destructive",
      });
      return;
    }
    setAccountSponsor(address, sponsorAddress);
  };

  const handleDeleteSponsor = () => {
    if (!address) return;
    deleteAccountSponsor(address);
  };

  const handleFaucet = () => {
    if (!address) return;
    const url = `https://faucet.recall.network/?address=${address}`;
    window.open(url, "_blank");
  };

  const hasSponsor =
    creditAccount &&
    creditAccount.creditSponsor !==
      "0x0000000000000000000000000000000000000000";
  const sponsorDisplay = hasSponsor
    ? displayAddress(creditAccount.creditSponsor)
    : "None";

  const capacityUsedDisplayData = creditAccount
    ? formatBytes(Number(creditAccount.capacityUsed))
    : undefined;

  const maxTtlDisplay = creditAccount
    ? creditAccount.maxTtl
      ? duration(
          Number(numBlocksToSeconds(creditAccount.maxTtl)) * 1000,
        ).humanize()
      : "None"
    : undefined;

  const setPending =
    setSponsorPending || (setSponsorTxnHash && setSponsorReceiptPending);
  const deletePending =
    deleteSponsorPending ||
    (deleteSponsorTxnHash && deleteSponsorReceiptPending);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BuyCreditsDialog open={buyCreditsOpen} setOpen={setBuyCreditsOpen} />
      <Dialog open={setSponsorOpen} onOpenChange={setSetSponsorOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Sponsor</DialogTitle>
            <DialogDescription>
              Set your default account sponsor and they will pay for credits and
              gas allowance you use from the approval they&apos;ve granted you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label>Wallet Address</Label>
              <Input
                id="to"
                value={sponsorAddress}
                onChange={(e) => setSponsorAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            {hasSponsor && (
              <Button
                variant="destructive"
                onClick={handleDeleteSponsor}
                disabled={deletePending}
              >
                Delete Sponsor
                {deletePending && <Loader2 className="animate-spin" />}
              </Button>
            )}
            <Button
              onClick={handleSetSponsor}
              disabled={setPending || !sponsorAddress}
            >
              Submit
              {setPending && <Loader2 className="animate-spin" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="col-span-2 rounded-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard />
            Credits
          </CardTitle>
          <CardDescription>
            Credits allow you to store data on the Recall network at a fixed
            rate. One credit stores one GB of data for one month and buying
            credits grants you gas allowance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="my-5 flex shrink-0 flex-wrap justify-around gap-8">
            <Metric
              title="Credit Available"
              value={
                creditAccount
                  ? `${attoCreditsToGbMonths(creditAccount.creditFree)}`
                  : undefined
              }
              subtitle="GB Months"
            />
            <Metric
              title="Credit Committed"
              value={
                creditAccount
                  ? `${attoCreditsToGbMonths(creditAccount.creditCommitted)}`
                  : undefined
              }
              subtitle="GB Months"
            />
            <Metric
              title="Gas Allowance"
              value={
                creditAccount
                  ? `${attoRecallToRecallDisplay(creditAccount.gasAllowance)}`
                  : undefined
              }
              subtitle="$RECALL"
            />
            <Metric
              title="Sponsor"
              value={sponsorDisplay}
              valueTooltip={
                hasSponsor ? creditAccount?.creditSponsor : undefined
              }
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-4 sm:justify-end">
          <Button onClick={() => setBuyCreditsOpen(true)}>Buy Credits</Button>
          <Button variant="outline" onClick={() => setSetSponsorOpen(true)}>
            Set Sponsor
          </Button>
        </CardFooter>
      </Card>
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign />
            RECALL Token
          </CardTitle>
          <CardDescription>
            $RECALL is the native token of the Recall network and can be used to
            buy credits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="my-8 flex shrink-0 flex-wrap justify-around gap-8">
            <Metric
              title="Balance"
              value={data ? attoRecallToRecallDisplay(data.value) : undefined}
              subtitle="$RECALL"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-4 sm:justify-end">
          <Button variant="outline" onClick={handleFaucet}>
            Testnet Faucet
          </Button>
        </CardFooter>
      </Card>
      <Card className="rounded-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database />
            Storage
          </CardTitle>
          <CardDescription>
            Information about your storage usage and limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="my-8 flex shrink-0 flex-wrap justify-around gap-8">
            <Metric
              title="Capacity Used"
              value={capacityUsedDisplayData?.val.toString()}
              subtitle={capacityUsedDisplayData?.unit}
            />
            <Metric
              title="Max TTL"
              value={maxTtlDisplay}
              valueTooltip={`${creditAccount?.maxTtl} blocks`}
            />
          </div>
        </CardContent>
      </Card>
      {/* <pre>
        {JSON.stringify(
          creditAccount,
          (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          2,
        )}
      </pre> */}
    </div>
  );
}
