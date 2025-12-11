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

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { Slider } from "@recallnet/ui2/components/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@recallnet/ui2/components/toggle-group";

import { Recall } from "@/components/Recall";
import { Button } from "@/components/staking/Button";
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
      <DialogContent className="bg-gray-2 border-gray-4 min-w-[500px] max-w-lg gap-0 overflow-hidden rounded-xl p-0 text-white">
        {/* Header */}
        <div className="border-gray-4 flex items-center justify-between border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Lock className="text-secondary-foreground size-5" />
            {step === "stake" && "Stake RECALL"}
            {step === "review" && "Review Stake"}
            {step === "signing" && "Sign Transaction"}
            {step === "confirming" && "Confirming Transaction"}
            {step === "success" && "Successful Stake"}
            {step === "error" && "Stake Failed"}
          </DialogTitle>
        </div>

        {/* Step 1: Stake Amount Selection */}
        {step === "stake" && (
          <>
            <div className="space-y-6 px-6 py-4">
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
                <div className="bg-gray-3 xs:m-0 m-auto flex w-fit items-center justify-center gap-2 rounded-lg p-3">
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

            <div className="border-gray-4 border-t px-6 py-4">
              <Button
                onClick={handleReview}
                disabled={stakeAmountRaw === 0n}
                className="w-full"
              >
                CONTINUE
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Review Stake */}
        {step === "review" && (
          <>
            <div className="space-y-6 px-6 py-4">
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
                  <div className="border-gray-4 rounded-2xl border p-0">
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

                    <div className="border-gray-4 border-t"></div>

                    <div className="text-secondary-foreground flex items-center gap-2 px-4 py-3 text-sm">
                      <Ban className="size-4 flex-shrink-0" />
                      <div className="text-primary-foreground">
                        You{" "}
                        <span className="text-yellow-400">cannot unstake</span>{" "}
                        before the unlock date.
                      </div>
                    </div>

                    <div className="border-gray-4 border-t"></div>

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

                    <div className="border-gray-4 border-t"></div>

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

            <div className="border-gray-4 flex flex-col gap-2 border-t px-6 py-4">
              {needsApproval || isApprovalPending ? (
                <Button
                  onClick={handleApprove}
                  disabled={!termsAccepted || isApprovalPending}
                  className="w-full"
                >
                  {isApprovalPending ? "APPROVING..." : "APPROVE"}
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
                variant="secondary"
                onClick={handleBack}
                className="flex w-full items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                CHOOSE STAKE AMOUNT
              </Button>
            </div>
          </>
        )}

        {/* Step 5: Signing Transaction */}
        {step === "signing" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 p-8">
              <div className="border-gray-4 h-12 w-12 animate-spin rounded-full border-4 border-t-blue-500"></div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  Waiting for signature...
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Please sign the transaction in your wallet
                </div>
              </div>
            </div>

            <div className="border-gray-4 border-t px-6 py-4">
              <Button disabled className="w-full">
                {isSigning ? "SIGNING..." : "WAITING FOR SIGNATURE"}
              </Button>
            </div>
          </>
        )}

        {/* Step 6: Confirming Transaction */}
        {step === "confirming" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 p-8">
              <div className="border-gray-4 h-12 w-12 animate-spin rounded-full border-4 border-t-green-500"></div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  Transaction submitted!
                </div>
                <div className="mt-2 text-sm text-gray-400">
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

            <div className="border-gray-4 border-t px-6 py-4">
              <Button disabled={isConfirming} className="w-full">
                {isConfirming ? "CONFIRMING..." : "CONFIRMED"}
              </Button>
            </div>
          </>
        )}

        {/* Step 7: Success */}
        {step === "success" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <div className="space-y-2 text-center">
                <div className="text-xl font-bold">Success!</div>
                <div className="text-gray-400">
                  You have successfully staked your RECALL tokens.
                </div>

                <div className="mx-auto grid max-w-[280px] grid-cols-2 gap-8 pt-4 text-left">
                  <div>
                    <div className="text-xs font-bold uppercase text-gray-500">
                      You Staked
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xl font-bold">
                      {formattedStakeAmount} <Recall size="sm" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-gray-500">
                      Boost
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xl font-bold">
                      {formattedBoostAmount}{" "}
                      <BoostIcon className="h-5 w-5 text-yellow-500" />
                    </div>
                  </div>
                </div>

                {/* Unlock Date */}
                <div className="pt-4">
                  <div className="text-xs font-bold uppercase text-gray-500">
                    UNLOCK DATE
                  </div>
                  <div className="mt-1 font-bold">
                    {formatUnlockDate(unlockDate)} UTC
                  </div>
                </div>
              </div>
            </div>

            <div className="border-gray-4 flex flex-col gap-2 border-t px-6 py-4">
              <Button onClick={handleClose} className="w-full">
                BACK TO STAKING
              </Button>
              <Button
                variant="secondary"
                onClick={handleShareOnX}
                className="flex w-full items-center justify-center gap-2"
              >
                <Share2Icon className="h-4 w-4" />
                SHARE ON X.COM
              </Button>
            </div>
          </>
        )}

        {/* Step 8: Error */}
        {step === "error" && (
          <>
            <div className="flex flex-col items-center justify-center space-y-6 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <X className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-500">Failed</div>
                <div className="mt-2 text-gray-400">{error}</div>
              </div>
            </div>

            <div className="border-gray-4 flex gap-4 border-t px-6 py-4">
              <Button
                variant="secondary"
                onClick={handleBack}
                className="flex-1"
              >
                TRY AGAIN
              </Button>
              <Button onClick={handleClose} className="flex-1">
                CLOSE
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StakeRecallModal;
