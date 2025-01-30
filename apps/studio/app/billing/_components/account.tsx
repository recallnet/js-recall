"use client";

import { useEffect } from "react";

import { useCreditAccount } from "@recall/sdkx/react/credits";
import { useToast } from "@recall/ui/hooks/use-toast";

export function Account() {
  const { toast } = useToast();

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

  return (
    <pre>
      {JSON.stringify(
        creditAccount,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      )}
    </pre>
  );
}
