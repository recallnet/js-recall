import * as dnum from "dnum";
import { ArrowLeft, Ban, Check, Lock, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { Slider } from "@recallnet/ui2/components/slider";
import { toast } from "@recallnet/ui2/components/toast";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@recallnet/ui2/components/toggle-group";

import { Recall } from "@/components/Recall";
import { useRelock } from "@/hooks/staking";
import { useSafeAccount, useSafeChainId } from "@/hooks/useSafeWagmi";
import { handleStakeTransactionError } from "@/lib/error-handling";
import { formatBigintAmount, shouldShowCompact } from "@/utils/format";

interface RelockRecallModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  tokenId: bigint;
  currentAmount: bigint;
}

type RelockStep =
  | "relock"
  | "review"
  | "signing"
  | "confirming"
  | "success"
  | "error";

/**
 * Predefined stake durations in seconds (as bigint)
 * These correspond to the allowed durations in the smart contract:
 * - 30, 90 days, 180 days, 365 days
 */
const STAKE_DURATIONS = {
  "30": BigInt(30 * 24 * 60 * 60), // 30 days in seconds
  "90": BigInt(90 * 24 * 60 * 60), // 90 days in seconds
  "180": BigInt(180 * 24 * 60 * 60), // 180 days in seconds
  "365": BigInt(365 * 24 * 60 * 60), // 365 days in seconds
} as const;

type StakeDurationKey = keyof typeof STAKE_DURATIONS;

/**
 * Calculates the unlock date based on the selected duration
 * @param durationKey - The selected duration key (30, 90, 180, 365)
 * @returns Date object representing the unlock date
 */
const getUnlockDate = (durationKey: StakeDurationKey): Date => {
  const now = new Date();
  const durationDays = parseInt(durationKey);
  const unlockDate = new Date(now);
  unlockDate.setDate(now.getDate() + durationDays);
  return unlockDate;
};

export const RelockRecallModal: React.FC<RelockRecallModalProps> = ({
  isOpen,
  onClose,
  tokenId,
  currentAmount,
}) => {
  const [step, setStep] = useState<RelockStep>("relock");
  // Amounts are tracked as bigint base units (decimals per token)
  const [relockAmountRaw, setRelockAmountRaw] = useState<bigint>(currentAmount);
  const [selectedDuration, setSelectedDuration] =
    useState<StakeDurationKey>("30");
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState<boolean>(true);

  const { address } = useSafeAccount();
  const chainId = useSafeChainId();
  const {
    execute: relock,
    isPending: isSigning,
    isConfirming,
    isConfirmed,
    error: writeError,
    transactionHash,
  } = useRelock();

  // Decimals with fallback (RECALL has 18 decimals)
  const decimals = 18;

  // Derived number values for UI controls (slider), safe to use for UX only
  const currentAmountTokensNumber = dnum.toNumber([currentAmount, decimals]);
  const relockAmountTokensNumber = dnum.toNumber([relockAmountRaw, decimals]);

  const unlockDate = getUnlockDate(selectedDuration);
  const relockDuration = STAKE_DURATIONS[selectedDuration];

  // Formatted values for the relock modal
  const getCompactAmount = (amount: bigint) => {
    return shouldShowCompact(amount, decimals, 1_000_000n);
  };
  const formattedCurrentAmount = formatBigintAmount(
    currentAmount,
    decimals,
    getCompactAmount(currentAmount),
  );
  const formattedRelockAmount = formatBigintAmount(
    relockAmountRaw,
    decimals,
    getCompactAmount(relockAmountRaw),
  );

  // Handle relock transaction success
  useEffect(() => {
    if (isConfirmed && step === "confirming") {
      setStep("success");
      toast.success("Successfully relocked tokens!");
    }
  }, [isConfirmed, step]);

  // Handle write errors
  useEffect(() => {
    if (writeError && (step === "signing" || step === "confirming")) {
      const userFriendlyError = handleStakeTransactionError(writeError, {
        stakeAmount: relockAmountTokensNumber,
        duration: selectedDuration,
        userAddress: address,
        chainId,
        additionalData: {
          step,
          stakeAmountBigInt: relockAmountRaw.toString(),
          transactionHash,
          tokenId: tokenId.toString(),
        },
      });
      setError(userFriendlyError);
      setStep("error");
      toast.error("Failed to relock tokens");
      console.error("Relock error:", writeError);
    }
  }, [
    writeError,
    relockAmountTokensNumber,
    selectedDuration,
    address,
    chainId,
    step,
    relockAmountRaw,
    transactionHash,
    tokenId,
  ]);

  // Handle transaction hash - transition to confirming step
  useEffect(() => {
    if (transactionHash && step === "signing") {
      setStep("confirming");
    }
  }, [transactionHash, step]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("relock");
      setRelockAmountRaw(currentAmount);
      setSelectedDuration("30");
      setError(null);
      setTermsAccepted(false);
      setIsCollapsibleOpen(true);
    }
  }, [isOpen, currentAmount]);

  // Calculate slider percentage
  const sliderPercentage = Math.round(
    currentAmountTokensNumber > 0
      ? (relockAmountTokensNumber * 100) / currentAmountTokensNumber
      : 0,
  );

  const handleAmountChange = (newAmountTokens: number) => {
    if (newAmountTokens < 0) return;
    if (newAmountTokens > currentAmountTokensNumber) return;
    // Convert number of tokens (UI) to bigint base units using token decimals
    const nextRaw = dnum.from(newAmountTokens, decimals)[0];
    // Ensure we do not exceed current amount
    setRelockAmountRaw(nextRaw > currentAmount ? currentAmount : nextRaw);
  };

  const handleSliderChange = (value: number[]) => {
    if (value[0] !== undefined) {
      handleAmountChange(value[0]);
    }
  };

  const handleReview = () => {
    setStep("review");
  };

  const handleRelock = async (): Promise<void> => {
    if (!termsAccepted) return;

    try {
      setStep("signing");
      // If relocking the full amount, use the two-arg overload
      if (relockAmountRaw === currentAmount) {
        await relock(tokenId, relockDuration);
      } else {
        // Otherwise use the three-arg overload for partial relock
        await relock(tokenId, relockDuration, relockAmountRaw);
      }
    } catch (error) {
      const userFriendlyError = handleStakeTransactionError(
        error instanceof Error ? error : new Error("Unknown error occurred"),
        {
          stakeAmount: relockAmountTokensNumber,
          duration: selectedDuration,
          userAddress: address,
          chainId,
          additionalData: {
            step: "handleRelock",
            stakeAmountBigInt: relockAmountRaw.toString(),
            tokenId: tokenId.toString(),
          },
        },
      );
      setError(userFriendlyError);
      setStep("error");
      toast.error("Failed to relock tokens");
      console.error("Relock error:", error);
    }
  };

  const handleBack = () => {
    setStep("relock");
    setError(null);
    setTermsAccepted(false);
    setIsCollapsibleOpen(true);
  };

  const handleClose = () => {
    onClose(false);
  };

  const formatUnlockDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  const setMaxRelockAmount = () => {
    setRelockAmountRaw(currentAmount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-xs">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-primary-foreground flex items-center justify-start gap-2 text-xl font-bold">
              <Lock className="text-secondary-foreground size-6" />
              {step === "relock" && "Relock RECALL"}
              {step === "review" && "Review Relock"}
              {step === "signing" && "Sign Transaction"}
              {step === "confirming" && "Confirming Transaction"}
              {step === "success" && "Successful Relock"}
              {step === "error" && "Relock Failed"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Step 1: Relock Amount Selection */}
        {step === "relock" && (
          <>
            <div className="space-y-6">
              {/* Amount Input */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div className="flex items-center justify-center gap-2 text-5xl font-bold">
                    {formattedRelockAmount}
                    <Recall size="md" />
                  </div>
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center"
                    onClick={setMaxRelockAmount}
                  >
                    <div className="text-secondary-foreground flex items-center justify-center gap-2 text-xl font-bold">
                      <Lock className="text-secondary-foreground h-5 w-5" />
                      <span className="text-primary-foreground">
                        {formattedCurrentAmount}
                      </span>
                    </div>
                    <span className="text-secondary-foreground text-sm font-bold">
                      STAKED
                    </span>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <Slider
                    value={[relockAmountTokensNumber]}
                    onValueChange={handleSliderChange}
                    max={currentAmountTokensNumber}
                    step={1}
                    className="w-full"
                  />
                  <div className="text-secondary-foreground flex justify-end text-sm">
                    <span className="font-bold">{sliderPercentage}%</span>
                  </div>
                </div>

                {/* Duration Selection */}
                <div className="space-y-3">
                  <ToggleGroup
                    type="single"
                    value={selectedDuration}
                    onValueChange={(value: string) => {
                      if (value) setSelectedDuration(value as StakeDurationKey);
                    }}
                    className="flex w-full gap-2"
                  >
                    <ToggleGroupItem value="30" className="flex-1">
                      30 Days
                    </ToggleGroupItem>
                    <ToggleGroupItem value="90" className="flex-1">
                      90 Days
                    </ToggleGroupItem>
                    <ToggleGroupItem value="180" className="flex-1">
                      180 Days
                    </ToggleGroupItem>
                    <ToggleGroupItem value="365" className="flex-1">
                      365 Days
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleReview}
                disabled={relockAmountRaw === 0n}
                className="w-full"
              >
                CONTINUE
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Review Relock */}
        {step === "review" && (
          <>
            <div className="space-y-6">
              {/* Relock Summary */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-center gap-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-secondary-foreground text-center text-sm font-bold uppercase">
                      You&apos;re relocking
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-bold">
                        {formattedRelockAmount}
                      </span>
                      <Recall size="md" />
                    </div>
                  </div>
                </div>

                {/* Unlock Date */}
                <div className="space-y-2 text-center">
                  <div className="text-secondary-foreground text-sm font-bold">
                    NEW UNLOCK DATE
                  </div>
                  <div className="font-bold">
                    {formatUnlockDate(unlockDate)} UTC
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-3">
                  <Collapsible
                    open={isCollapsibleOpen}
                    onOpenChange={setIsCollapsibleOpen}
                  >
                    <div className="flex w-full items-center justify-between">
                      <label className="flex w-full items-center gap-2">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => {
                            setTermsAccepted(e.target.checked);
                            setIsCollapsibleOpen(!e.target.checked);
                          }}
                        />

                        <span className="text-primary-foreground text-sm">
                          I have read and accepted the{" "}
                          <a
                            href="https://recall.network/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Terms and Conditions
                          </a>
                          .
                        </span>
                      </label>

                      <CollapsibleTrigger className="w-fit" />
                    </div>

                    <CollapsibleContent className="rounded-2xl border p-0">
                      <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                        <Lock className="size-4 flex-shrink-0" />
                        <div className="text-primary-foreground">
                          Your RECALL tokens will be{" "}
                          <span className="text-yellow-400">
                            {" "}
                            locked for {selectedDuration} days.
                          </span>
                        </div>
                      </div>

                      <div className="border-t"></div>

                      <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                        <Ban className="size-4 flex-shrink-0" />
                        <div className="text-primary-foreground">
                          You{" "}
                          <span className="text-yellow-400">
                            cannot unstake
                          </span>{" "}
                          before the unlock date.
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:flex-col">
              <Button
                onClick={handleRelock}
                disabled={!termsAccepted || isSigning}
                className="w-full"
              >
                {isSigning ? "SIGNING..." : "RELOCK"}
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex w-full items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                CHOOSE RELOCK AMOUNT
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Signing Transaction */}
        {step === "signing" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500"></div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  Please sign the transaction in your wallet...
                </div>
                <div className="text-sm text-gray-400">
                  Confirm the transaction to relock your tokens
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button disabled className="w-full">
                {isSigning ? "SIGNING..." : "WAITING FOR SIGNATURE"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Confirming Transaction */}
        {step === "confirming" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-green-500"></div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  Transaction submitted!
                </div>
                <div className="text-sm text-gray-400">
                  Waiting for network confirmation...
                </div>
                {transactionHash && (
                  <div className="mt-2 text-xs text-gray-500">
                    Hash: {transactionHash.slice(0, 10)}...
                    {transactionHash.slice(-8)}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button disabled={isConfirming} className="w-full">
                {isConfirming ? "CONFIRMING..." : "CONFIRMED"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 5: Success */}
        {step === "success" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <Check className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  You have successfully relocked your RECALL tokens.
                </div>

                <div className="mt-10">
                  <div className="flex items-baseline justify-center gap-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-secondary-foreground text-center text-sm font-bold uppercase">
                        You relocked
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-4xl font-bold">
                          {formattedRelockAmount}
                        </span>
                        <Recall size="md" />
                      </div>
                    </div>
                  </div>

                  {/* Unlock Date */}
                  <div className="mt-6 space-y-2 text-center">
                    <div className="text-secondary-foreground text-sm font-bold">
                      NEW UNLOCK DATE
                    </div>
                    <div className="font-bold">
                      {formatUnlockDate(unlockDate)} UTC
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:flex-col">
              <Button onClick={handleClose} className="w-full">
                BACK TO STAKING
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 6: Error */}
        {step === "error" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
                <X className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-400">
                  Relock Failed
                </div>
                <div className="mt-2 text-sm text-gray-400">{error}</div>
              </div>
            </div>

            <DialogFooter className="flex w-full gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                TRY AGAIN
              </Button>
              <Button onClick={handleClose} className="flex-1">
                CLOSE
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RelockRecallModal;
