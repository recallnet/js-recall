"use client";

import TimeAgo from "javascript-time-ago";
import { Copy, Loader2, Trash } from "lucide-react";
import { useEffect } from "react";
import { useBlockNumber, useWaitForTransactionReceipt } from "wagmi";

import { displayAddress } from "@recall/address-utils/display";
import {
  crazyCreditsToGbMonths,
  numBlocksToSeconds,
  recallToDisplay,
} from "@recall/bigint-utils/conversions";
import {
  useCreditAccount,
  useRevokeCreditApproval,
} from "@recall/sdkx/react/credits";
import { Button } from "@recall/ui/components/button";
import { Card, CardContent } from "@recall/ui/components/card";
import { useToast } from "@recall/ui/hooks/use-toast";

interface Props {
  approvalTo: {
    addr: `0x${string}`;
    approval: {
      creditLimit: bigint;
      gasFeeLimit: bigint;
      expiry: bigint;
      creditUsed: bigint;
      gasFeeUsed: bigint;
    };
  };
}

const timeAgo = new TimeAgo("en-US");

export function Approval({ approvalTo }: Props) {
  const { toast } = useToast();

  const { refetch: refetchCreditAccount } = useCreditAccount();

  const { data: blockNumber } = useBlockNumber();

  const {
    revokeCredit,
    data: revokeTxHash,
    isPending: revokePending,
  } = useRevokeCreditApproval();

  const { isPending: revokeTxPending, isSuccess: revokeSucces } =
    useWaitForTransactionReceipt({ hash: revokeTxHash });

  useEffect(() => {
    if (revokeSucces) {
      refetchCreditAccount();
    }
  }, [revokeSucces, refetchCreditAccount]);

  const creditUsedDisplay = crazyCreditsToGbMonths(
    approvalTo.approval.creditUsed,
  );
  const creditLimitDisplay =
    approvalTo.approval.creditLimit === BigInt(0)
      ? "∞"
      : crazyCreditsToGbMonths(approvalTo.approval.creditLimit);

  const gasFeeUsedDisplay = recallToDisplay(approvalTo.approval.gasFeeUsed);
  const gasFeeLimitDisplay =
    approvalTo.approval.gasFeeLimit === BigInt(0)
      ? "∞"
      : recallToDisplay(approvalTo.approval.gasFeeLimit);

  const expiryMillis =
    blockNumber && !!approvalTo.approval.expiry
      ? Date.now() +
        Number(numBlocksToSeconds(approvalTo.approval.expiry - blockNumber)) *
          1000
      : undefined;
  const expiryIso = expiryMillis
    ? new Date(expiryMillis).toLocaleString()
    : undefined;
  const ttlDisplay =
    approvalTo.approval.expiry === BigInt(0)
      ? "Never"
      : expiryMillis
        ? timeAgo.format(expiryMillis)
        : undefined;

  const pending = revokePending || (revokeTxHash && revokeTxPending);

  const handleCopy = () => {
    navigator.clipboard.writeText(approvalTo.addr);
    toast({
      title: "Address copied",
      description: approvalTo.addr,
    });
  };

  const handleRevoke = () => {
    revokeCredit(approvalTo.addr);
  };

  return (
    <Card className="rounded-none">
      <CardContent className="pt-6">
        <div className="flex items-center gap-8">
          <div className="flex grow flex-col gap-4">
            <div className="flex items-center gap-2">
              <span title={approvalTo.addr} className="text-xl font-bold">
                {displayAddress(approvalTo.addr)}
              </span>
              <span title="Copy address" onClick={handleCopy}>
                <Copy className="size-4 cursor-pointer opacity-20 hover:opacity-100" />
              </span>
            </div>
            <div className="flex justify-between">
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground text-xs">
                  Credits used
                </span>
                <span className="text-lg font-medium">
                  {creditUsedDisplay}/{creditLimitDisplay}
                </span>
                <span className="text-muted-foreground text-sm">GB Months</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground text-xs">Gas used</span>
                <span className="text-lg font-medium">
                  {gasFeeUsedDisplay}/{gasFeeLimitDisplay}
                </span>
                <span className="text-muted-foreground text-sm">$RECALL</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-muted-foreground text-xs">Expires</span>
                {ttlDisplay && (
                  <span title={expiryIso} className="text-lg font-medium">
                    {ttlDisplay}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="group"
            title="Revoke approval"
            disabled={pending}
            onClick={handleRevoke}
          >
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Trash className="opacity-20 group-hover:opacity-100" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
