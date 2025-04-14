import { Loader2 } from "lucide-react";
import { ComponentProps, useEffect, useState } from "react";
import { useAccount, useBalance, useWaitForTransactionReceipt } from "wagmi";

import { recallToAttoRecall } from "@recallnet/bigint-utils/conversions";
import { useWithdraw } from "@recallnet/sdkx/react/account";
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

export default function WithdrawDialog({
  onOpenChange,
  ...props
}: ComponentProps<typeof Dialog>) {
  const { address } = useAccount();
  const { refetch: refetchBalance } = useBalance({ address });
  const [amount, setAmount] = useState("");
  const {
    withdraw,
    isPending,
    error: withdrawError,
    data: txHash,
  } = useWithdraw();
  const {
    data: receipt,
    isLoading,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (receipt?.status === "success") {
      refetchBalance();
      toast.success("Withdrawal successful");
      onOpenChange?.(false);
    }
  }, [onOpenChange, receipt, refetchBalance]);

  useEffect(() => {
    if (receiptError || withdrawError) {
      toast.error("Error withdrawing $RECALL", {
        description:
          receiptError?.message || withdrawError?.message || "Unknown error",
      });
    }
  }, [receiptError, withdrawError]);

  const onSubmit = () => {
    if (!address) return;
    withdraw(address, recallToAttoRecall(amount));
  };

  const pending = isPending || isLoading;

  return (
    <Dialog onOpenChange={onOpenChange} {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw $RECALL</DialogTitle>
          <DialogDescription>
            $RECALL will be moved from your account on the Recall network to
            your account on the Filecoin network.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Label>$RECALL</Label>
          <Input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
