import * as dnum from "dnum";
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
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";

import { Button } from "@recallnet/ui2/components/button";
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
import { useStake } from "@/hooks/staking";
import { useRecall } from "@/hooks/useRecall";
import { useStakingContractAddress } from "@/hooks/useStakingContract";
import { useTokenApproval } from "@/hooks/useTokenApproval";
import {
  handleApprovalError,
  handleStakeTransactionError,
} from "@/lib/error-handling";
import { formatDateRange } from "@/lib/format-date-range";
import { formatBigintAmount, shouldShowCompact } from "@/utils/format";

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
  // Amounts are tracked as bigint base units (decimals per token)
  const [stakeAmountRaw, setStakeAmountRaw] = useState<bigint>(0n);
  const [selectedDuration, setSelectedDuration] =
    useState<StakeDurationKey>("30");
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);

  const { address } = useAccount();
  const chainId = useChainId();
  const recall = useRecall();
  const stakingContractAddress = useStakingContractAddress();
  const tokenApproval = useTokenApproval(recall.token, stakingContractAddress);
  const {
    execute: stake,
    isPending: isSigning,
    isConfirming,
    isConfirmed,
    error: writeError,
    transactionHash,
  } = useStake();

  // Decimals with fallback
  const decimals =
    recall.isLoading || recall.decimals === undefined ? 18 : recall.decimals;

  // Available tokens as bigint base units
  const availableRaw =
    recall.isLoading || recall.value === undefined ? 0n : recall.value;

  // Derived number values for UI controls (slider), safe to use for UX only
  const availableTokensNumber = dnum.toNumber([availableRaw, decimals]);
  const stakeAmountTokensNumber = dnum.toNumber([stakeAmountRaw, decimals]);

  // Boost equals staked amount (same units)
  const boostAmountRaw = stakeAmountRaw;
  const unlockDate = getUnlockDate(selectedDuration);
  const stakeDuration = STAKE_DURATIONS[selectedDuration];

  // Formatted values for the staking modal
  const getCompactAmount = (amount: bigint) => {
    return shouldShowCompact(amount, decimals, 1_000_000n);
  };
  const formattedAvailable = formatBigintAmount(
    availableRaw,
    decimals,
    getCompactAmount(availableRaw),
  );
  const formattedStakeAmount = formatBigintAmount(
    stakeAmountRaw,
    decimals,
    getCompactAmount(stakeAmountRaw),
  );
  const formattedBoostAmount = formatBigintAmount(
    boostAmountRaw,
    decimals,
    getCompactAmount(boostAmountRaw),
  );

  // Check if approval is currently pending (loading or confirming)
  const isApprovalPending =
    tokenApproval.isApprovalLoading || tokenApproval.isApprovalConfirming;

  // Check if approval is needed
  const needsApproval = tokenApproval.isLoading
    ? false
    : isApprovalPending || tokenApproval.needsApproval(stakeAmountRaw);

  // Handle stake transaction success
  useEffect(() => {
    if (isConfirmed && step === "confirming") {
      setStep("success");
    }
  }, [isConfirmed, step]);

  // Handle write errors
  useEffect(() => {
    if (writeError && (step === "signing" || step === "confirming")) {
      const userFriendlyError = handleStakeTransactionError(writeError, {
        stakeAmount: stakeAmountTokensNumber,
        duration: selectedDuration,
        userAddress: address,
        chainId,
        additionalData: {
          step,
          stakeAmountBigInt: stakeAmountRaw.toString(),
          transactionHash,
        },
      });
      setError(userFriendlyError);
      setStep("error");
    }
  }, [
    writeError,
    stakeAmountTokensNumber,
    selectedDuration,
    address,
    chainId,
    step,
    stakeAmountRaw,
    transactionHash,
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
      setStep("stake");
      setStakeAmountRaw(0n);
      setSelectedDuration("30");
      setError(null);
      setTermsAccepted(false);
    }
  }, [isOpen]);

  // Calculate slider percentage
  const sliderPercentage = Math.round(
    availableTokensNumber > 0
      ? (stakeAmountTokensNumber * 100) / availableTokensNumber
      : 0,
  );

  const handleAmountChange = (newAmountTokens: number) => {
    if (newAmountTokens < 0) return;
    if (newAmountTokens > availableTokensNumber) return;
    // Convert number of tokens (UI) to bigint base units using token decimals
    const nextRaw = dnum.from(newAmountTokens, decimals)[0];
    // Ensure we do not exceed available
    setStakeAmountRaw(nextRaw > availableRaw ? availableRaw : nextRaw);
  };

  const handleSliderChange = (value: number[]) => {
    if (value[0] !== undefined) {
      handleAmountChange(value[0]);
    }
  };

  const handleReview = () => {
    setStep("review");
  };

  // Approval and staking handlers used by action components
  const handleApprove = async (): Promise<void> => {
    if (!termsAccepted) return;
    try {
      await tokenApproval.approve(stakeAmountRaw);
    } catch (error) {
      const userFriendlyError = handleApprovalError(
        error instanceof Error ? error : new Error("Unknown error occurred"),
        {
          stakeAmount: stakeAmountTokensNumber,
          duration: selectedDuration,
          userAddress: address,
          chainId,
          additionalData: {
            step: "handleApprove",
            stakeAmountBigInt: stakeAmountRaw.toString(),
          },
        },
      );
      setError(userFriendlyError);
      setStep("error");
    }
  };

  const handleStake = async (): Promise<void> => {
    if (!termsAccepted) return;

    try {
      setStep("signing");
      await stake(stakeAmountRaw, stakeDuration);
    } catch (error) {
      const userFriendlyError = handleStakeTransactionError(
        error instanceof Error ? error : new Error("Unknown error occurred"),
        {
          stakeAmount: stakeAmountTokensNumber,
          duration: selectedDuration,
          userAddress: address,
          chainId,
          additionalData: {
            step: "handleStake",
            stakeAmountBigInt: stakeAmountRaw.toString(),
          },
        },
      );
      setError(userFriendlyError);
      setStep("error");
    }
  };

  const handleBack = () => {
    setStep("stake");
    setError(null);
    setTermsAccepted(false);
  };

  const handleClose = () => {
    onClose(false);
  };

  const handleShareOnX = () => {
    const formattedStake = formatBigintAmount(stakeAmountRaw);
    const formattedBoost = formatBigintAmount(boostAmountRaw);
    const shareText = `I just staked ${formattedStake} $RECALL tokens and got ${formattedBoost} boost ⚡️`;

    const currentUrl = window.location.origin;

    const twitterUrl = new URL("https://twitter.com/intent/tweet");
    twitterUrl.searchParams.set("text", shareText);
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
    setStakeAmountRaw(availableRaw);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-xs max-w-lg">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-primary-foreground flex items-center justify-start gap-2 text-xl font-bold">
              <Lock className="text-secondary-foreground size-6" />
              {step === "stake" && "Stake RECALL"}
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
                    {formattedStakeAmount}
                    <Recall size="md" />
                  </div>
                  <div
                    className="flex cursor-pointer flex-col items-center justify-center"
                    onClick={setMaxStakeAmount}
                  >
                    <div className="text-secondary-foreground flex items-center justify-center gap-2 text-xl font-bold">
                      <Wallet className="text-secondary-foreground h-5 w-5" />
                      <span className="text-primary-foreground">
                        {formattedAvailable}
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
                    value={[stakeAmountTokensNumber]}
                    onValueChange={handleSliderChange}
                    max={availableTokensNumber}
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

                {/* Boost Display */}
                <div className="xs:m-0 m-auto flex w-fit items-center justify-center gap-2 rounded-lg bg-gray-800 p-3">
                  <span className="text-primary-foreground text-xl font-bold">
                    +{formattedBoostAmount}
                  </span>
                  <BoostIcon className="size-4" />
                  <span className="text-secondary-foreground text-sm font-bold">
                    BOOST
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleReview}
                disabled={stakeAmountRaw === 0n}
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
                        {formattedStakeAmount}
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
                        {formattedBoostAmount}
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
                    STAKE PERIOD
                  </div>
                  <div className="font-bold">
                    {formatDateRange(new Date(), unlockDate)}
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-3">
                  <div className="rounded-2xl border p-0">
                    <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                      <Lock className="size-4 flex-shrink-0" />
                      <div className="text-primary-foreground">
                        Your RECALL tokens will be{" "}
                        <span className="text-yellow-400">
                          {" "}
                          staked for {selectedDuration} days.
                        </span>
                      </div>
                    </div>

                    <div className="border-t"></div>

                    <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                      <Ban className="size-4 flex-shrink-0" />
                      <div className="text-primary-foreground">
                        You{" "}
                        <span className="text-yellow-400">cannot unstake</span>{" "}
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
                        after staking.
                      </div>
                    </div>

                    <div className="border-t"></div>

                    <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                      <OctagonMinus className="size-4 shrink-0" />
                      <div className="text-primary-foreground">
                        After Unstaking, a{" "}
                        <span className="text-yellow-400">
                          30-day cooldown period
                        </span>{" "}
                        will begin. Tokens are only withdrawable after the
                        cooldown.
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between">
                    <label className="flex w-full items-center gap-2">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked);
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
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:flex-col">
              {needsApproval || isApprovalPending ? (
                <Button
                  onClick={handleApprove}
                  disabled={!termsAccepted || isApprovalPending}
                  className="w-full"
                >
                  {isApprovalPending ? "APPROVING..." : "Approve"}
                </Button>
              ) : (
                <Button
                  onClick={handleStake}
                  disabled={!termsAccepted || isSigning}
                  className="w-full"
                >
                  {isSigning ? "SIGNING..." : "STAKE & LOCK"}
                </Button>
              )}
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

        {/* Step 5: Signing Transaction */}
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

        {/* Step 6: Confirming Transaction */}
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

        {/* Step 7: Success */}
        {step === "success" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <Check className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  You have successfully staked your RECALL tokens.
                </div>

                <div className="mt-10">
                  <div className="flex items-baseline justify-evenly gap-4 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-secondary-foreground text-center text-sm font-bold uppercase">
                        You staked
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-4xl font-bold">
                          {formattedStakeAmount}
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
                          {formattedBoostAmount}
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

        {/* Step 8: Error */}
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
