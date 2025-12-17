import { format } from "date-fns";
import {
  Calendar,
  Check,
  ChevronRight,
  Link as LinkIcon,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { Label } from "@recallnet/ui2/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@recallnet/ui2/components/radio-group";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { BoostIcon } from "@/components/BoostIcon";
import { Recall } from "@/components/Recall";
import { Button } from "@/components/staking/Button";
import { useAirdropClaim } from "@/hooks/useAirdropClaim";
import { FormattedConvictionClaim } from "@/hooks/useConvictionClaims";
import { formatBigintAmount, shouldShowCompact } from "@/utils/format";

interface ConvictionStakeModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  claim: FormattedConvictionClaim | null;
}

type StakeStep = "select" | "signing" | "confirming" | "success" | "error";

const DURATION_OPTIONS = [
  { label: "No stake", subLabel: "Receive 10%", duration: 0n, percentage: 10n },
  {
    label: "3 months",
    subLabel: "Receive 40%",
    duration: BigInt(90 * 24 * 60 * 60),
    percentage: 40n,
  },
  {
    label: "6 months",
    subLabel: "Receive 60%",
    duration: BigInt(180 * 24 * 60 * 60),
    percentage: 60n,
  },
  {
    label: "9 months",
    subLabel: "Receive 80%",
    duration: BigInt(270 * 24 * 60 * 60),
    percentage: 80n,
  },
  {
    label: "12 months",
    subLabel: "Receive 100%",
    duration: BigInt(365 * 24 * 60 * 60),
    percentage: 100n,
  },
] as const;

export const ConvictionStakeModal: React.FC<ConvictionStakeModalProps> = ({
  isOpen,
  onClose,
  claim: claimItem,
}) => {
  const [step, setStep] = useState<StakeStep>("select");
  const [selectedDurationIndex, setSelectedDurationIndex] = useState<number>(4); // Default to 12 months (index 4)

  const {
    claim,
    isConfirmed,
    error: writeError,
    transactionHash,
  } = useAirdropClaim();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("select");
      setSelectedDurationIndex(4); // Reset to 12 months
    }
  }, [isOpen]);

  // Handle transaction hash -> confirming
  useEffect(() => {
    if (transactionHash && step === "signing") {
      setStep("confirming");
    }
  }, [transactionHash, step]);

  // Handle confirmation -> success
  useEffect(() => {
    if (isConfirmed && step === "confirming") {
      setStep("success");
    }
  }, [isConfirmed, step]);

  // Handle error
  useEffect(() => {
    if (writeError && (step === "signing" || step === "confirming")) {
      setStep("error");
    }
  }, [writeError, step]);

  const handleClose = () => {
    if (step === "signing" || step === "confirming") {
      return; // Prevent closing during processing
    }
    onClose(false);
  };

  // Helper to narrow type
  const isClaimAvailable = claimItem && claimItem.type === "available";

  // Calculations
  const selectedOption = DURATION_OPTIONS[selectedDurationIndex];
  const eligibleAmount = isClaimAvailable ? claimItem.eligibleAmount : 0n;

  const percentage = selectedOption?.percentage ?? 0n;
  const duration = selectedOption?.duration ?? 0n;

  const unlockAmount = (eligibleAmount * percentage) / 100n;
  const boostGain = unlockAmount;

  const handleStake = async () => {
    if (!isClaimAvailable) return;

    try {
      setStep("signing");
      const option = DURATION_OPTIONS[selectedDurationIndex];
      if (!option) {
        throw new Error("Invalid duration selected");
      }

      const claimPayload = {
        season: claimItem.season,
        seasonName: claimItem.seasonName,
        type: claimItem.type,
        eligibleAmount: claimItem.eligibleAmount,
        expiresAt: claimItem.expiresAt,
        proof: claimItem.proof,
        signature: undefined,
      };

      await claim(claimPayload, option.duration);
    } catch (err) {
      console.error("Error claiming:", err);
      setStep("error");
    }
  };

  // Unlock Date
  const unlockDate = useMemo(() => {
    const date = new Date();
    date.setTime(date.getTime() + Number(duration) * 1000);
    return date;
  }, [duration]);

  const formattedUnlockDate = format(unlockDate, "yyyy/MM/dd");

  // Format amounts
  const decimals = 18; // Assuming 18 for RECALL
  const formattedUnlockAmount = formatBigintAmount(
    unlockAmount,
    decimals,
    shouldShowCompact(unlockAmount, decimals, 1_000_000n),
  );
  const formattedBoostGain = formatBigintAmount(
    boostGain,
    decimals,
    shouldShowCompact(boostGain, decimals, 1_000_000n),
  );

  if (!isClaimAvailable) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-2 border-gray-4 min-w-[500px] max-w-md gap-0 overflow-hidden rounded-xl p-0 text-white">
        {/* Header */}
        <div className="border-gray-4 flex items-center justify-between border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            Conviction Staking{" "}
            <span className="text-secondary-foreground flex items-center gap-1 text-xs font-normal">
              <LinkIcon size={12} />
              <a
                href="https://blog.recall.network/conviction-staking"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary-foreground cursor-pointer underline"
              >
                Learn More
              </a>
            </span>
          </DialogTitle>
        </div>

        {step === "select" && (
          <>
            <div className="space-y-6 px-6 py-3">
              {/* Duration Selection */}
              <RadioGroup
                value={selectedDurationIndex.toString()}
                onValueChange={(v: string) =>
                  setSelectedDurationIndex(parseInt(v))
                }
                className="flex flex-col gap-5"
              >
                {DURATION_OPTIONS.map((option, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <RadioGroupItem
                      value={index.toString()}
                      id={`option-${index}`}
                      className="mt-1 border-gray-600 text-white data-[state=checked]:border-white data-[state=checked]:text-white"
                    />
                    <Label
                      htmlFor={`option-${index}`}
                      className="flex w-full cursor-pointer flex-col items-start gap-1 text-left normal-case"
                    >
                      {" "}
                      <span
                        className={`text-base ${selectedDurationIndex === index ? "text-gray-6 font-bold" : "text-gray-5 font-normal"}`}
                      >
                        {option.label}
                      </span>
                      <span className="text-gray-5 text-sm font-normal">
                        {option.subLabel}
                      </span>{" "}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Summary Footer */}
            <div className="border-gray-4 flex items-center justify-between border-t px-5 py-4">
              <div className="border-gray-4 border-l pl-3">
                <div className="text-gray-6 mb-1 flex items-center gap-1 text-xs font-semibold">
                  <Calendar size={12} />{" "}
                  <Tooltip content={unlockDate.toUTCString()}>
                    {formattedUnlockDate}
                  </Tooltip>
                </div>
                <div className="text-gray-5 text-xs">Receive Date</div>
              </div>
              <div className="border-gray-4 border-l pl-3">
                <div className="text-gray-6 mb-1 flex items-center gap-1 text-sm font-semibold">
                  <Recall size="sm" backgroundClass="bg-white" />{" "}
                  {formattedUnlockAmount}
                </div>
                <div className="text-gray-5 text-xs">Receive Amount</div>
              </div>
              <div className="border-gray-4 border-l pl-3">
                <div className="text-gray-6 mb-1 flex items-center gap-1 text-sm font-semibold">
                  <BoostIcon className="h-4 w-4 text-yellow-500" />{" "}
                  {formattedBoostGain}
                </div>
                <div className="text-gray-5 text-xs">Boost Gain</div>
              </div>
              <Button
                onClick={handleStake}
                className="h-12 px-6 text-base font-bold"
              >
                STAKE <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </>
        )}

        {/* Processing Steps */}
        {(step === "signing" || step === "confirming") && (
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <div
              className={`border-gray-4 h-12 w-12 animate-spin rounded-full border-4 ${step === "signing" ? "border-t-blue-500" : "border-t-green-500"}`}
            ></div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {step === "signing"
                  ? "Waiting for signature..."
                  : "Transaction submitted!"}
              </div>
              <div className="mt-2 text-sm text-gray-400">
                {step === "signing"
                  ? "Please sign the transaction in your wallet"
                  : "Waiting for network confirmation..."}
              </div>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <div className="space-y-2 text-center">
              <div className="text-xl font-bold">Success!</div>
              <div className="text-gray-400">
                You have successfully claimed your rewards.
              </div>
              <div className="mx-auto grid max-w-[200px] grid-cols-2 gap-8 pt-4 text-left">
                <div>
                  <div className="text-xs font-bold uppercase text-gray-500">
                    You Got
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xl font-bold">
                    {formattedUnlockAmount} <Recall size="sm" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-gray-500">
                    Boost
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xl font-bold">
                    {formattedBoostGain}{" "}
                    <BoostIcon className="h-5 w-5 text-yellow-500" />
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleClose} className="mt-4 w-full">
              CLOSE
            </Button>
          </div>
        )}

        {/* Error Step */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <X className="h-8 w-8 text-red-500" />
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-500">Failed</div>
              <div className="mt-2 text-gray-400">
                {writeError
                  ? writeError.message
                  : "An error occurred while processing your transaction."}
              </div>
            </div>
            <div className="flex w-full gap-4">
              <Button
                variant="secondary"
                onClick={() => setStep("select")}
                className="flex-1"
              >
                TRY AGAIN
              </Button>
              <Button onClick={handleClose} className="flex-1">
                CLOSE
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
