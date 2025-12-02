"use client";

import { ArrowDown } from "lucide-react";
import { ComponentPropsWithoutRef, useEffect } from "react";

import { Spinner } from "@recallnet/ui2/components/spinner";
import { toast } from "@recallnet/ui2/components/toast";

import { useClaim } from "@/hooks/useClaim";

import { Button } from "./Button";

export const ClaimButton = (props: ComponentPropsWithoutRef<typeof Button>) => {
  const { claims, claim, isPending, isConfirming, isConfirmed, error } =
    useClaim();

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
    <Button
      {...props}
      onClick={handleClaim}
      disabled={isProcessing || claims.length === 0}
      className="group relative flex items-center justify-center overflow-hidden transition-all"
    >
      {isProcessing ? (
        <>
          <Spinner />
          <span className="ml-2">Claiming...</span>
        </>
      ) : (
        <span className="flex items-center">
          <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:w-[3.5rem] group-hover:opacity-100">
            CLAIM
          </span>
          <ArrowDown className="h-4 w-4 shrink-0 transition-transform duration-300" />
        </span>
      )}
    </Button>
  );
};
