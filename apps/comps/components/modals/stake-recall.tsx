"use client";

import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  Lock,
  OctagonMinus,
  Share2Icon,
  TrendingUp,
  Wallet,
  X,
  ZapOff,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { valueToAttoBigInt } from "@recallnet/conversions/atto-conversions";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@recallnet/ui2/components/toggle-group";

import { Recall } from "@/components/Recall";
import { useRecall } from "@/hooks/useRecall";
import { useStakingContract } from "@/hooks/useStakingContract";

import { BoostIcon } from "../BoostIcon";

interface StakeRecallModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}

type StakeStep =
  | "stake"
  | "review"
  | "signing"
  | "confirming"
  | "success"
  | "error";

/**
 * Predefined stake durations in seconds (as bigint)
 * These correspond to the allowed durations in the smart contract:
 * - 90 days, 180 days, 270 days, 365 days
 */
const STAKE_DURATIONS = {
  "90": BigInt(90 * 24 * 60 * 60), // 90 days in seconds
  "180": BigInt(180 * 24 * 60 * 60), // 180 days in seconds
  "270": BigInt(270 * 24 * 60 * 60), // 270 days in seconds
  "365": BigInt(365 * 24 * 60 * 60), // 365 days in seconds
} as const;

type StakeDurationKey = keyof typeof STAKE_DURATIONS;

/**
 * Calculates the unlock date based on the selected duration
 * @param durationKey - The selected duration key (90, 180, 270, 365)
 * @returns Date object representing the unlock date
 */
const getUnlockDate = (durationKey: StakeDurationKey): Date => {
  const now = new Date();
  const durationDays = parseInt(durationKey);
  const unlockDate = new Date(now);
  unlockDate.setDate(now.getDate() + durationDays);
  return unlockDate;
};

export const StakeRecallModal: React.FC<StakeRecallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<StakeStep>("stake");
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [selectedDuration, setSelectedDuration] =
    useState<StakeDurationKey>("90");
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState<boolean>(true);

  const recall = useRecall();
  const {
    stake,
    isPending: isSigning,
    isConfirming,
    isConfirmed,
    writeError,
    transactionHash,
  } = useStakingContract();

  // Calculate available tokens
  const availableTokens = recall.isLoading
    ? 0
    : Number(recall.value ?? 0n) / 1e18;
  const stakeAmountBigInt = valueToAttoBigInt(stakeAmount);
  const boostAmount = stakeAmount;
  const unlockDate = getUnlockDate(selectedDuration);
  const stakeDuration = STAKE_DURATIONS[selectedDuration];

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed) {
      setStep("success");
    }
  }, [isConfirmed]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      setError(writeError.message);
      setStep("error");
    }
  }, [writeError]);

  // Handle transaction hash - transition to confirming step
  useEffect(() => {
    if (transactionHash && step === "signing") {
      setStep("confirming");
    }
  }, [transactionHash, step]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("stake");
      setStakeAmount(0);
      setSelectedDuration("90");
      setError(null);
      setTermsAccepted(false);
      setIsCollapsibleOpen(true);
    }
  }, [isOpen]);

  // Calculate slider percentage
  const sliderPercentage = Math.round(
    availableTokens > 0 ? (stakeAmount * 100) / availableTokens : 0,
  );

  const handleAmountChange = (newAmount: number) => {
    if (newAmount >= 0 && newAmount <= availableTokens) {
      setStakeAmount(newAmount);
    }
  };

  const handleSliderChange = (value: number[]) => {
    if (value[0] !== undefined) {
      handleAmountChange(value[0]);
    }
  };

  const handleReview = () => {
    setStep("review");
  };

  const handleConfirm = async () => {
    if (!termsAccepted) return;

    try {
      setStep("signing");
      await stake(stakeAmountBigInt, stakeDuration);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Transaction failed");
      setStep("error");
    }
  };

  const handleBack = () => {
    setStep("stake");
  };

  const handleClose = () => {
    onClose(false);
  };

  const handleShareOnX = () => {
    const shareText = `I just staked ${stakeAmount.toLocaleString()} $RECALL tokens and got ${boostAmount.toLocaleString()} boost! 🚀`;

    const hashtags = "Staking,Recall,Boost";

    const currentUrl = window.location.href;

    const twitterUrl = new URL("https://twitter.com/intent/tweet");
    twitterUrl.searchParams.set("text", shareText);
    twitterUrl.searchParams.set("hashtags", hashtags);
    twitterUrl.searchParams.set("url", currentUrl);

    window.open(twitterUrl.toString(), "_blank", "width=550,height=420");
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

  const setMaxStakeAmount = () => {
    setStakeAmount(availableTokens);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[500px] max-w-[90vw]">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-primary-foreground flex items-center justify-start gap-2 text-xl font-bold">
              <Lock className="text-secondary-foreground size-6" />
              {step === "stake" && "Stake $RECALL"}
              {step === "review" && "Review Stake"}
              {step === "signing" && "Sign Transaction"}
              {step === "confirming" && "Confirming Transaction"}
              {step === "success" && "Successful Stake"}
              {step === "error" && "Stake Failed"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Step 1: Stake Amount Selection */}
        {step === "stake" && (
          <>
            <div className="space-y-6">
              {/* Amount Input */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div className="flex items-center justify-center gap-2 text-5xl font-bold">
                    {stakeAmount.toLocaleString()}
                    <Recall size="md" />
                  </div>
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center"
                    onClick={setMaxStakeAmount}
                  >
                    <div className="text-secondary-foreground flex items-center justify-center gap-2 text-xl font-bold">
                      <Wallet className="text-secondary-foreground h-5 w-5" />
                      <span className="text-primary-foreground">
                        {availableTokens.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-secondary-foreground text-sm font-bold">
                      AVAILABLE
                    </span>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <Slider
                    value={[stakeAmount]}
                    onValueChange={handleSliderChange}
                    max={availableTokens}
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
                    <ToggleGroupItem value="90" className="flex-1">
                      90 Days
                    </ToggleGroupItem>
                    <ToggleGroupItem value="180" className="flex-1">
                      180 Days
                    </ToggleGroupItem>
                    <ToggleGroupItem value="270" className="flex-1">
                      270 Days
                    </ToggleGroupItem>
                    <ToggleGroupItem value="365" className="flex-1">
                      365 Days
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Boost Display */}
                <div className="flex w-fit items-center justify-center gap-2 rounded-lg bg-gray-800 p-3">
                  <span className="text-primary-foreground text-xl font-bold">
                    +{boostAmount.toLocaleString()}
                  </span>
                  <BoostIcon className="size-4" fill />
                  <span className="text-secondary-foreground text-sm font-bold">
                    BOOST
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleReview}
                disabled={stakeAmount <= 0}
                className="w-full"
              >
                CONTINUE
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Review Stake */}
        {step === "review" && (
          <>
            <div className="space-y-6">
              {/* Stake Summary */}
              <div className="space-y-4">
                <div className="flex items-baseline justify-evenly gap-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-secondary-foreground text-center text-sm font-bold uppercase">
                      You&apos;re staking
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-bold">
                        {stakeAmount.toLocaleString()}
                      </span>
                      <Recall size="md" />
                    </div>
                  </div>
                  <ArrowRight className="text-secondary-foreground size-5 self-center" />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-secondary-foreground text-center text-sm font-bold uppercase">
                      You&apos;ll get
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-bold">
                        {boostAmount.toLocaleString()}
                      </span>
                      <BoostIcon className="size-5" />
                    </div>
                    <div className="text-secondary-foreground text-center text-sm font-bold">
                      PER COMPETITION
                    </div>
                  </div>
                </div>

                {/* Unlock Date */}
                <div className="space-y-2 text-center">
                  <div className="text-secondary-foreground text-sm font-bold">
                    UNLOCK DATE
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
                          Your $RECALL tokens will be{" "}
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

                      <div className="border-t"></div>

                      <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                        <TrendingUp className="text-secondary-foreground size-4 flex-shrink-0" />
                        <div className="text-primary-foreground">
                          Your Boost will be{" "}
                          <span className="text-yellow-400">
                            increased instantly
                          </span>{" "}
                          after Staking.
                        </div>
                      </div>

                      <div className="border-t"></div>

                      <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                        <ZapOff className="text-secondary-foreground size-4 flex-shrink-0" />
                        <div className="text-primary-foreground">
                          Boosts are{" "}
                          <span className="text-yellow-400">
                            non-refundable
                          </span>
                          .
                        </div>
                      </div>

                      <div className="border-t"></div>

                      <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                        <OctagonMinus className="text-secondary-foreground size-4 flex-shrink-0" />
                        <div className="text-primary-foreground">
                          Boosts{" "}
                          <span className="text-yellow-400">
                            may be removed
                          </span>{" "}
                          from a token if it&apos;s flagged as malicious by our
                          moderators or third-party auditors.
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:flex-col">
              <Button
                onClick={handleConfirm}
                disabled={!termsAccepted || isSigning}
                className="w-full"
              >
                {isSigning ? "SIGNING..." : "STAKE & LOCK"}
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex w-full items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                CHOOSE STAKE AMOUNT
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
                  Confirm the transaction to stake your tokens
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
                  You have successfully staked your $RECALL tokens.
                </div>

                <div className="mt-10">
                  <div className="flex items-baseline justify-evenly gap-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-secondary-foreground text-center text-sm font-bold uppercase">
                        You staked
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-4xl font-bold">
                          {stakeAmount.toLocaleString()}
                        </span>
                        <Recall size="md" />
                      </div>
                    </div>
                    <ArrowRight className="text-secondary-foreground size-5 self-center" />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-secondary-foreground text-center text-sm font-bold uppercase">
                        You got
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-4xl font-bold">
                          {boostAmount.toLocaleString()}
                        </span>
                        <BoostIcon className="size-5" />
                      </div>
                      <div className="text-secondary-foreground text-center text-sm font-bold">
                        PER COMPETITION
                      </div>
                    </div>
                  </div>

                  {/* Unlock Date */}
                  <div className="mt-6 space-y-2 text-center">
                    <div className="text-secondary-foreground text-sm font-bold">
                      UNLOCK DATE
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
              <Button
                variant="outline"
                onClick={handleShareOnX}
                className="flex w-full items-center gap-2"
              >
                <Share2Icon className="h-4 w-4" />
                SHARE ON X.COM
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
                  Stake Failed
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

export default StakeRecallModal;
