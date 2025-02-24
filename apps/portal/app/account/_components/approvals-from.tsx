"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { useCreditAccount } from "@recallnet/sdkx/react/credits";
import { useToast } from "@recallnet/ui/hooks/use-toast";

import { Approval } from "./approval";

export function ApprovalsFrom() {
  const { toast } = useToast();

  const { data: creditAccount, error: creditAccountError } = useCreditAccount();

  useEffect(() => {
    if (creditAccountError) {
      toast({
        title: "Error",
        description: creditAccountError.message,
        variant: "destructive",
      });
    }
  }, [creditAccountError, toast]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {!creditAccount && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {creditAccount && !creditAccount.approvalsFrom.length && (
        <div className="flex flex-1 items-center justify-center">
          No approvals to display.
        </div>
      )}
      {creditAccount?.approvalsFrom.map((approval) => {
        return (
          <Approval
            key={approval.addr}
            type="from"
            creditSponsor={creditAccount?.creditSponsor}
            approval={approval}
          />
        );
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
    </div>
  );
}
