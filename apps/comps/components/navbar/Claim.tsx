import * as dnum from "dnum";
import { useEffect } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { toast } from "@recallnet/ui2/components/toast";

import { Recall } from "@/components/Recall";
import { useClaim } from "@/hooks/useClaim";

export const Claim = () => {
  const { totalClaimable, claim, isPending, isConfirming, isConfirmed, error } =
    useClaim();

  const display = dnum.format([totalClaimable, 18], { compact: true });

  const isProcessing = isPending || isConfirming;
  const disabled = totalClaimable === 0n || isProcessing;

  // Show success toast when claim is confirmed
  useEffect(() => {
    if (isConfirmed) {
      toast.success("Successfully claimed rewards!");
    }
  }, [isConfirmed]);

  // Show error toast when there's an error
  useEffect(() => {
    if (error) {
      toast.error("Failed to claim rewards");
      console.error("Claim error:", error);
    }
  }, [error]);

  const handleClaim = async () => {
    try {
      await claim(undefined);
    } catch (err) {
      // Error is already handled by the error effect above
      console.error("Claim error:", err);
    }
  };

  return (
    <Button
      className="flex items-center gap-2"
      onClick={handleClaim}
      disabled={disabled}
    >
      <span>{isProcessing ? "Claiming..." : "Claim"}</span>
      {isConfirming ? null : (
        <>
          <Recall size="sm" backgroundClass="bg-white" />
          <span className="font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px]">
            {display}
          </span>
        </>
      )}
    </Button>
  );
};
