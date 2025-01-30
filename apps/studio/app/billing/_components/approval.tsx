"use client";

import TimeAgo from "javascript-time-ago";
import { Copy, Handshake, Loader2, Trash } from "lucide-react";
import { useEffect } from "react";
import {
  useAccount,
  useBlockNumber,
  useWaitForTransactionReceipt,
} from "wagmi";

import { displayAddress } from "@recall/address-utils/display";
import {
  crazyCreditsToGbMonths,
  numBlocksToSeconds,
  recallToDisplay,
} from "@recall/bigint-utils/conversions";
import {
  useCreditAccount,
  useRevokeCreditApproval,
  useSetAccountSponsor,
} from "@recall/sdkx/react/credits";
import { Card, CardContent } from "@recall/ui/components/card";
import { useToast } from "@recall/ui/hooks/use-toast";
import { cn } from "@recall/ui/lib/utils";

interface Props {
  type: "to" | "from";
  creditSponsor?: `0x${string}`;
  approval: {
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

export function Approval({ type, creditSponsor, approval }: Props) {
  const { toast } = useToast();

  const { address } = useAccount();

  const { refetch: refetchCreditAccount } = useCreditAccount();

  const { data: blockNumber } = useBlockNumber();

  const {
    revokeCredit,
    data: revokeTxHash,
    isPending: revokePending,
    error: revokeError,
  } = useRevokeCreditApproval();

  const { isPending: revokeTxPending, isSuccess: revokeSucces } =
    useWaitForTransactionReceipt({ hash: revokeTxHash });

  const {
    setAccountSponsor,
    data: setSponsorTxHash,
    isPending: setSponsorPending,
    error: setSponsorError,
  } = useSetAccountSponsor();

  const { isPending: setSponsorTxPending, isSuccess: setSponsorSuccess } =
    useWaitForTransactionReceipt({ hash: setSponsorTxHash });

  useEffect(() => {
    if (revokeSucces || setSponsorSuccess) {
      refetchCreditAccount();
    }
  }, [revokeSucces, setSponsorSuccess, refetchCreditAccount]);

  useEffect(() => {
    if (revokeError || setSponsorError) {
      toast({
        title: "Error",
        description: revokeError?.message || setSponsorError?.message,
      });
    }
  }, [revokeError, setSponsorError, toast]);

  const handleCopy = () => {
    navigator.clipboard.writeText(approval.addr);
    toast({
      title: "Address copied",
      description: approval.addr,
    });
  };

  const handleRevoke = () => {
    revokeCredit(approval.addr);
  };

  const handleSetSponsor = () => {
    if (!address) return;
    setAccountSponsor(address, approval.addr);
  };

  const creditUsedDisplay = crazyCreditsToGbMonths(
    approval.approval.creditUsed,
  );
  const creditLimitDisplay =
    approval.approval.creditLimit === BigInt(0)
      ? "∞"
      : crazyCreditsToGbMonths(approval.approval.creditLimit);

  const gasFeeUsedDisplay = recallToDisplay(approval.approval.gasFeeUsed);
  const gasFeeLimitDisplay =
    approval.approval.gasFeeLimit === BigInt(0)
      ? "∞"
      : recallToDisplay(approval.approval.gasFeeLimit);

  const blockDiff =
    blockNumber && !!approval.approval.expiry
      ? approval.approval.expiry - blockNumber
      : undefined;
  const expiryMillis = blockDiff
    ? Date.now() + Number(numBlocksToSeconds(blockDiff)) * 1000
    : undefined;
  const expiryIso = expiryMillis
    ? new Date(expiryMillis).toLocaleString()
    : undefined;
  const ttlDisplay =
    approval.approval.expiry === BigInt(0)
      ? "Never"
      : expiryMillis
        ? timeAgo.format(expiryMillis)
        : undefined;

  const isSponsor = creditSponsor === approval.addr;
  const pending =
    revokePending ||
    (revokeTxHash && revokeTxPending) ||
    setSponsorPending ||
    (setSponsorTxHash && setSponsorTxPending);

  return (
    <Card className="rounded-none">
      <CardContent className="pt-6">
        <div className="flex items-center gap-8">
          <div className="flex grow flex-col gap-4">
            <div className="flex items-center gap-2">
              <span title={approval.addr} className="text-xl font-bold">
                {displayAddress(approval.addr)}
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
                <span className="text-muted-foreground text-xs">
                  Expire{blockDiff || 1 < 0 ? "d" : "s"}
                </span>
                {ttlDisplay && (
                  <span title={expiryIso} className="text-lg font-medium">
                    {ttlDisplay}
                  </span>
                )}
              </div>
            </div>
          </div>
          {type === "to" && (
            <div
              title="Revoke approval"
              onClick={pending ? undefined : handleRevoke}
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash className="opacity-10 hover:cursor-pointer hover:opacity-100" />
              )}
            </div>
          )}
          {type === "from" && (
            <div
              title={isSponsor ? "Is default sponsor" : "Make default sponsor"}
              onClick={
                isSponsor ? undefined : pending ? undefined : handleSetSponsor
              }
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Handshake
                  className={cn(
                    "opacity-10 hover:cursor-pointer hover:opacity-100",
                    isSponsor && "opacity-100 hover:cursor-default",
                  )}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
