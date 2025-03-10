"use client";

import TimeAgo from "javascript-time-ago";
import { Copy, Handshake, Loader2, Trash, Wallet } from "lucide-react";
import { useEffect } from "react";
import {
  useAccount,
  useBlockNumber,
  useWaitForTransactionReceipt,
} from "wagmi";

import { displayAddress } from "@recallnet/address-utils/display";
import {
  attoCreditsToGbMonths,
  attoRecallToRecallDisplay,
  numBlocksToSeconds,
} from "@recallnet/bigint-utils/conversions";
import {
  useCreditAccount,
  useRevokeCreditApproval,
  useSetAccountSponsor,
} from "@recallnet/sdkx/react/credits";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import { useToast } from "@recallnet/ui/hooks/use-toast";
import { cn } from "@recallnet/ui/lib/utils";

import Metric from "@/components/metric";

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

  const creditUsedDisplay = attoCreditsToGbMonths(approval.approval.creditUsed);
  const creditLimitDisplay =
    approval.approval.creditLimit === BigInt(0)
      ? "∞"
      : attoCreditsToGbMonths(approval.approval.creditLimit);

  const gasFeeUsedDisplay = attoRecallToRecallDisplay(
    approval.approval.gasFeeUsed,
  );
  const gasFeeLimitDisplay =
    approval.approval.gasFeeLimit === BigInt(0)
      ? "∞"
      : attoRecallToRecallDisplay(approval.approval.gasFeeLimit);

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
      <CardHeader>
        <CardTitle title={approval.addr} className="flex items-center gap-2">
          <Wallet />
          {displayAddress(approval.addr)}
          <span title="Copy address" onClick={handleCopy}>
            <Copy className="size-4 cursor-pointer opacity-20 hover:opacity-100" />
          </span>
          {type === "to" && (
            <div
              title="Revoke approval"
              onClick={pending ? undefined : handleRevoke}
              className="ml-auto"
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
              className="ml-auto"
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
        </CardTitle>
      </CardHeader>
      <CardContent className="">
        <div className="flex grow flex-col gap-4">
          <div className="my-4 flex shrink-0 flex-wrap justify-around gap-8">
            <Metric
              title="Credits used"
              value={`${creditUsedDisplay}/${creditLimitDisplay}`}
              subtitle="GB Months"
            />
            <Metric
              title="Gas used"
              value={`${gasFeeUsedDisplay}/${gasFeeLimitDisplay}`}
              subtitle="$RECALL"
            />
            <Metric
              title={`Expire${(blockDiff || 1) < 0 ? "d" : "s"}`}
              value={ttlDisplay}
              valueTooltip={expiryIso}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
