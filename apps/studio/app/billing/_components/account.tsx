"use client";

import { CreditCard, Database, DollarSign } from "lucide-react";
import { duration } from "moment";
import { useEffect } from "react";
import { useAccount, useBalance } from "wagmi";

import { displayAddress } from "@recall/address-utils/display";
import {
  crazyCreditsToCredits,
  creditsToGbMonths,
  numBlocksToSeconds,
  recallToDisplay,
} from "@recall/bigint-utils/conversions";
import { useCreditAccount } from "@recall/sdkx/react/credits";
import { Button } from "@recall/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@recall/ui/components/card";
import { useToast } from "@recall/ui/hooks/use-toast";

import Metric from "./metric";

export function Account() {
  const { toast } = useToast();

  const { address } = useAccount();

  const { data } = useBalance({ address });

  const {
    data: creditAccount,
    error: creditAccountError,
    refetch: refetchCreditAccount,
  } = useCreditAccount();

  useEffect(() => {
    if (creditAccountError) {
      toast({
        title: "Error",
        description: creditAccountError.message,
        variant: "destructive",
      });
    }
  }, [creditAccountError, toast]);

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
    ? duration(
        Number(numBlocksToSeconds(creditAccount.maxTtl)) * 1000,
      ).humanize()
    : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
          <div className="flex shrink-0 flex-wrap justify-around gap-8">
            <Metric
              title="Credit Available"
              value={
                creditAccount
                  ? `${creditsToGbMonths(crazyCreditsToCredits(creditAccount.creditFree))}`
                  : undefined
              }
              subtitle="GB Months"
            />
            <Metric
              title="Credit Committed"
              value={
                creditAccount
                  ? `${creditsToGbMonths(crazyCreditsToCredits(creditAccount.creditCommitted))}`
                  : undefined
              }
              subtitle="GB Months"
            />
            <Metric
              title="Gas Allowance"
              value={
                creditAccount
                  ? `${recallToDisplay(creditAccount.gasAllowance)}`
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
          <Button variant="outline" className="">
            Buy Credits
          </Button>
          <Button variant="outline">Set Sponsor</Button>
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
          <div className="flex shrink-0 flex-wrap justify-around gap-8">
            <Metric
              title="Balance"
              value={data ? recallToDisplay(data.value) : undefined}
              subtitle="$RECALL"
            />
          </div>
        </CardContent>
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
          <div className="flex shrink-0 flex-wrap justify-around gap-8">
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

// TODO:Convert to bigint
const formatBytes = (bytes: number) => {
  const sizes = (i: number, val: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (i === 0 && val === 1) return "Byte";
    return sizes[i];
  };
  if (bytes === 0) return { val: 0, unit: "Bytes" };
  const i = Number.parseInt(
    Math.floor(Math.log(bytes) / Math.log(1024)).toString(),
  );
  const val = Math.round((bytes / Math.pow(1024, i)) * 100) / 100;
  return {
    val,
    unit: sizes(i, val),
  };
};
