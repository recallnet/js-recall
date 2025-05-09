"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Address } from "viem";
import { isAddress } from "viem";
import { useAccount, useConfig, useWaitForTransactionReceipt } from "wagmi";

import {
  gbMonthsToCredits,
  hoursToNumBlocks,
  recallToAttoRecall,
} from "@recallnet/conversions";
import { accountExists, createAccount } from "@recallnet/react/actions/credits";
import {
  useApproveCredit,
  useCreditAccount,
} from "@recallnet/react/hooks/credits";
import { Button } from "@recallnet/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/shadcn/dialog";
import { Input } from "@recallnet/ui/components/shadcn/input";
import { Label } from "@recallnet/ui/components/shadcn/label";
import { toast } from "@recallnet/ui/components/toast";

import { Approval } from "./approval";

export function ApprovalsTo() {
  const config = useConfig();

  const [newApprovalOpen, setNewApprovalOpen] = useState(false);

  const { address: from } = useAccount();

  const {
    data: creditAccount,
    error: creditAccountError,
    refetch: refetchCreditAccount,
  } = useCreditAccount();

  const {
    mutateAsync: runCreateAccount,
    isPending: isCreateAccountPending,
    error: createAccountError,
  } = useMutation({
    mutationFn: createAccount,
  });

  const {
    approveCredit,
    data: approvalTxHash,
    isPending: isApprovalPending,
    error: approvalError,
  } = useApproveCredit();

  const {
    isPending: isApprovalReceiptPending,
    isSuccess: isApprovalReceiptSuccess,
    error: approvalReceiptError,
  } = useWaitForTransactionReceipt({ hash: approvalTxHash });

  const [formData, setFormData] = useState<{
    to: Address | "";
    creditLimit: string;
    gasFeeLimit: string;
    ttl: string;
  }>({
    to: "",
    creditLimit: "",
    gasFeeLimit: "",
    ttl: "",
  });

  useEffect(() => {
    if (creditAccountError) {
      toast.error("Error", {
        description: creditAccountError.message,
      });
    }
  }, [creditAccountError]);

  useEffect(() => {
    if (approvalError) {
      toast.error("Error", {
        description: approvalError.message,
      });
    }
  }, [approvalError]);

  useEffect(() => {
    if (approvalReceiptError) {
      toast.error("Error", {
        description: approvalReceiptError.message,
      });
    }
  }, [approvalReceiptError]);

  useEffect(() => {
    if (createAccountError) {
      toast.error("Error", {
        description: createAccountError.message,
      });
    }
  }, [createAccountError]);

  useEffect(() => {
    if (isApprovalReceiptSuccess) {
      refetchCreditAccount();
      setNewApprovalOpen(false);
    }
  }, [isApprovalReceiptSuccess, refetchCreditAccount]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleApprove = async () => {
    if (!from || !formData.to) return;
    if (!isAddress(formData.to)) {
      toast.error("Invalid address", {
        description: "Please enter a valid address",
      });
      return;
    }
    const exists = await accountExists(config, formData.to);
    if (!exists) {
      await runCreateAccount({ config, address: formData.to });
    }
    const limits =
      !!formData.creditLimit || !!formData.gasFeeLimit || !!formData.ttl
        ? {
            creditLimit: gbMonthsToCredits(formData.creditLimit || 0),
            gasFeeLimit: recallToAttoRecall(formData.gasFeeLimit || 0n),
            ttl: hoursToNumBlocks(formData.ttl || 0),
          }
        : undefined;
    approveCredit(formData.to, { limits });
  };

  const approvalPending =
    isCreateAccountPending ||
    isApprovalPending ||
    (!!approvalTxHash && isApprovalReceiptPending);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Dialog open={newApprovalOpen} onOpenChange={setNewApprovalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Approval</DialogTitle>
            <DialogDescription>
              You can approve other wallet addresses to spend your Recall
              credits and gas allowance.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label>Wallet Address</Label>
              <Input
                id="to"
                placeholder="0x..."
                value={formData.to}
                onChange={handleChange}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="creditLimit">
                Credit Limit{" "}
                <span className="text-muted-foreground">(GiB Months)</span>
              </Label>
              <Input
                id="creditLimit"
                type="number"
                placeholder="∞"
                min={1}
                value={formData.creditLimit ? formData.creditLimit : ""}
                onChange={handleChange}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gasFeeLimit">
                Gas Limit{" "}
                <span className="text-muted-foreground">($RECALL)</span>
              </Label>
              <Input
                id="gasFeeLimit"
                type="number"
                placeholder="∞"
                min={1}
                value={formData.gasFeeLimit ? formData.gasFeeLimit : ""}
                onChange={handleChange}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ttl">
                Expires in{" "}
                <span className="text-muted-foreground">
                  (Hour{formData.ttl !== "1" ? "s" : ""})
                </span>
              </Label>
              <Input
                id="ttl"
                type="number"
                placeholder="∞"
                min={1}
                value={formData.ttl ? formData.ttl : ""}
                onChange={handleChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleApprove}
              disabled={approvalPending || !formData.to}
            >
              Submit
              {approvalPending && <Loader2 className="animate-spin" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!creditAccount && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {creditAccount && !creditAccount.approvalsTo.length && (
        <div className="flex flex-1 items-center justify-center">
          No approvals to display. You can create one if you&apos;d like.
        </div>
      )}
      {creditAccount?.approvalsTo.map((approval) => {
        return <Approval key={approval.addr} type="to" approval={approval} />;
      })}
      {/* {creditAccount && (
        <pre>
          {JSON.stringify(
            creditAccount,
            (key, value) =>
              typeof value === "bigint" ? value.toString() : value,
            2,
          )}
        </pre>
      )} */}
      <Button
        variant="outline"
        className="self-end"
        onClick={() => setNewApprovalOpen(true)}
      >
        <Plus />
        New Approval
      </Button>
    </div>
  );
}
