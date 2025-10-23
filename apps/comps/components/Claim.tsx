import * as dnum from "dnum";
import { ComponentPropsWithoutRef, useEffect } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Spinner } from "@recallnet/ui2/components/spinner";
import { toast } from "@recallnet/ui2/components/toast";

import { Recall } from "@/components/Recall";
import { useClaim } from "@/hooks/useClaim";

export const Claim = (props: ComponentPropsWithoutRef<"div">) => {
  const {
    claims,
    totalClaimable,
    claim,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  } = useClaim();

  const display = dnum.format([totalClaimable, 18], {
    compact: true,
    digits: 5,
  });

  const isProcessing = isPending || isConfirming;

  useEffect(() => {
    if (isConfirmed) {
      toast.success("Successfully claimed rewards!");
    }
  }, [isConfirmed]);

  useEffect(() => {
    if (error) {
      toast.error("Failed to claim rewards");
      console.error("Claim error:", error);
    }
  }, [error]);

  const handleClaim = () => {
    claim(claims);
  };

  return (
    <div {...props}>
      {isProcessing ? (
        <Button className="flex items-center gap-2" disabled>
          <Spinner />
          Claiming...
        </Button>
      ) : (
        <Button className="flex items-center gap-2" onClick={handleClaim}>
          <span>Claim</span>
          <>
            <Recall size="sm" backgroundClass="bg-white" />
            <span className="font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px]">
              {display}
            </span>
          </>
        </Button>
      )}
    </div>
  );
};
