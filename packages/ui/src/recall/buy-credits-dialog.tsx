import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useWaitForTransactionReceipt } from "wagmi";

import {
  creditsToRecall,
  gbMonthsToCredits,
  recallToDisplay,
} from "@recall/bigint-utils/conversions";
import { useBuyCredit, useCreditAccount } from "@recall/sdkx/react/credits";
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

export default function BuyCreditsDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const [displayCredits, setDisplayCredits] = useState("0");

  const { refetch: refetchCreditAccount } = useCreditAccount();

  const {
    buyCredit,
    error: buyCreditError,
    isPending: buyCreditPending,
    data: buyCreditTxn,
  } = useBuyCredit();

  const {
    isPending: buyCreditReceiptIsPending,
    isSuccess: buyCreditReceiptSuccess,
  } = useWaitForTransactionReceipt({
    hash: buyCreditTxn,
    query: {
      enabled: !!buyCreditTxn,
    },
  });

  useEffect(() => {
    if (buyCreditReceiptSuccess) {
      refetchCreditAccount();
      setOpen(false);
    }
  }, [buyCreditReceiptSuccess, refetchCreditAccount, setOpen]);

  useEffect(() => {
    if (buyCreditError) {
      toast({
        title: "Error buying credits",
        description: buyCreditError.message,
      });
    }
  }, [buyCreditError, toast]);

  const handleBuyCredits = async () => {
    buyCredit(recallToSpend);
  };

  const creditsToBuy = gbMonthsToCredits(displayCredits || 0);
  const recallToSpend = creditsToRecall(creditsToBuy);
  const recallToSpendDisplay = recallToDisplay(recallToSpend, 4);

  const creditPending =
    buyCreditPending || (!!buyCreditTxn && buyCreditReceiptIsPending);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
  );
}
