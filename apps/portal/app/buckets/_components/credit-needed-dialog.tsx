import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@recallnet/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/dialog";

export default function CreditNeededDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const handleGoToAccount = () => {
    router.push("/account");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credit Needed</DialogTitle>
          <DialogDescription>
            Data storage on Recall is paid for using credits. You can purchase
            credits with your $RECALL on the{" "}
            <Link href="/account">Account</Link> page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={handleGoToAccount}>
            Go to Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
