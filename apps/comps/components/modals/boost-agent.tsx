import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CircleCheck,
  Minus,
  Plus,
  Share2Icon,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { Slider } from "@recallnet/ui2/components/slider";

import { AgentAvatar } from "@/components/agent-avatar";
import { RankBadge } from "@/components/agents-table/rank-badge";
import { useBoostAgent } from "@/hooks/useBoost";
import { AgentCompetition } from "@/types";
import { formatPercentage } from "@/utils/format";

interface BoostAgentModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  agent: AgentCompetition | null;
  availableBoost: bigint;
  currentAgentBoostTotal: bigint;
  currentUserBoostAmount: bigint;
  competitionId: string;
}

type BoostStep = "choose" | "review" | "loading" | "success" | "error";

export const BoostAgentModal: React.FC<BoostAgentModalProps> = ({
  isOpen,
  onClose,
  agent,
  availableBoost,
  currentAgentBoostTotal,
  currentUserBoostAmount,
  competitionId,
}) => {
  const [step, setStep] = useState<BoostStep>("choose");
  const [boostAmount, setBoostAmount] = useState<bigint>(availableBoost);
  const [error, setError] = useState<string | null>(null);

  const { mutate: boostAgent, isPending: isBoosting } = useBoostAgent({
    onSuccess: () => {
      setStep("success");
    },
    onError: (error) => {
      setError(error.message);
      setStep("error");
    },
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("choose");
      setBoostAmount(availableBoost);
      setError(null);
    }
  }, [isOpen, availableBoost]);

  // Calculate slider percentage
  const sliderPercentage =
    availableBoost > 0n ? Number((boostAmount * 100n) / availableBoost) : 0;

  // Calculate new values after boost
  const newAgentBoostTotal = currentAgentBoostTotal + boostAmount;
  const newUserBoostAmount = currentUserBoostAmount + boostAmount;
  const newUserPercentage =
    newAgentBoostTotal > 0n
      ? Number((newUserBoostAmount * 100n) / newAgentBoostTotal)
      : 0;
  const currentUserPercentage =
    currentAgentBoostTotal > 0n
      ? Number((currentUserBoostAmount * 100n) / currentAgentBoostTotal)
      : 0;

  const handleAmountChange = (newAmount: bigint) => {
    if (newAmount >= 0n && newAmount <= availableBoost) {
      setBoostAmount(newAmount);
    }
  };

  const handleIncrement = () => {
    const increment = 1n; // Change by 1
    const newAmount = boostAmount + increment;
    handleAmountChange(newAmount > availableBoost ? availableBoost : newAmount);
  };

  const handleDecrement = () => {
    const decrement = 1n; // Change by 1
    const newAmount = boostAmount - decrement;
    handleAmountChange(newAmount < 0n ? 0n : newAmount);
  };

  const handleReview = () => {
    setStep("review");
  };

  const handleConfirm = () => {
    if (!agent) return;

    setStep("loading");
    boostAgent({
      competitionId,
      agentId: agent.id,
      currentAgentBoostTotal,
      amount: boostAmount,
    });
  };

  const handleBack = () => {
    setStep("choose");
  };

  const handleClose = () => {
    onClose(false);
  };

  if (!agent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[500px] max-w-[90vw]">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
              <Bot className="size-6 text-gray-700" />
              {step === "choose" && "Choose Boost Amount"}
              {step === "review" && "Review Boost Allocation"}
              {step === "loading" && "Processing Boost"}
              {step === "success" && "Successful Boost"}
              {step === "error" && "Boost Failed"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Step 1: Choose Boost Amount */}
        {step === "choose" && (
          <>
            <div className="space-y-6">
              {/* Agent Info */}
              <div className="flex items-center gap-4">
                <AgentAvatar agent={agent} size={48} />
                <div>
                  <div className="flex items-center gap-2">
                    <RankBadge rank={agent.rank} />
                    <span className="text-lg font-bold">{agent.name}</span>
                  </div>
                  <p className="text-sm text-gray-400">{agent.description}</p>
                </div>
              </div>

              {/* Boost Amount Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDecrement}
                    disabled={boostAmount <= 0n}
                    className="h-10 w-10 rounded-full p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>

                  <div className="text-center">
                    <div className="flex items-center gap-2 text-3xl font-bold">
                      <Zap className="h-6 w-6 text-yellow-500" />
                      {boostAmount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-400">
                      {availableBoost.toLocaleString()} AVAILABLE
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleIncrement}
                    disabled={boostAmount >= availableBoost}
                    className="h-10 w-10 rounded-full p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <Slider
                    value={[Number(boostAmount)]}
                    onValueChange={([value]) => {
                      if (value !== undefined) {
                        const newAmount = BigInt(value);
                        handleAmountChange(newAmount);
                      }
                    }}
                    max={Number(availableBoost)}
                    step={1}
                    className="w-full"
                  />
                  <div className="text-secondary-foreground flex justify-end text-xs font-bold">
                    <span>{sliderPercentage}%</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleReview}
                disabled={boostAmount <= 0n}
                className="w-full"
              >
                REVIEW
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Review Boost Allocation */}
        {step === "review" && (
          <>
            <div className="space-y-6">
              {/* Agent Info */}
              <div className="flex items-center gap-4">
                <AgentAvatar agent={agent} size={48} />
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">
                    +{boostAmount.toLocaleString()}
                  </span>
                  <Zap className="h-6 w-6 text-yellow-500" />
                </div>
              </div>

              {/* Boost Summary */}
              <div className="space-y-4">
                {/* Agent Boost Pool */}
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                  <div className="mb-2 text-sm font-semibold text-gray-300">
                    AGENT BOOST POOL
                  </div>
                  <div className="relative grid grid-cols-2 grid-rows-1">
                    {/* Current boost total */}
                    <div className="flex items-center gap-2 text-xl font-bold">
                      <span>{currentAgentBoostTotal.toLocaleString()}</span>
                      <Zap className="h-4 w-4 text-yellow-500" />
                    </div>

                    {/* New boost total with increment */}
                    <div className="flex items-center gap-2 text-xl font-bold">
                      <span>{newAgentBoostTotal.toLocaleString()}</span>
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-xs font-normal text-green-500">
                        +{boostAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="absolute left-1/2 top-1/2 flex -translate-x-20 -translate-y-1/2 items-center justify-center">
                      <ArrowRight className="h-4 w-4 text-gray-500" />
                    </div>
                  </div>
                </div>

                {/* Your Share */}
                <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                  <div className="mb-2 text-sm font-semibold text-gray-300">
                    YOUR SHARE
                  </div>
                  <div className="relative grid grid-cols-2 grid-rows-2">
                    {/* Row 1, Col 1: Current percentage */}
                    <div className="text-lg font-bold">
                      {formatPercentage(currentUserPercentage, 100)}
                    </div>

                    {/* Row 1, Col 2: New percentage with increment */}
                    <div className="text-lg">
                      <span className="font-bold">
                        {formatPercentage(newUserPercentage, 100)}
                      </span>
                      <span className="ml-1 text-xs text-green-500">
                        +
                        {formatPercentage(
                          newUserPercentage - currentUserPercentage,
                          100,
                        )}
                      </span>
                    </div>

                    {/* Row 2, Col 1: Current boost amount */}
                    <div className="flex items-center gap-1 text-sm text-yellow-500">
                      <span>{currentUserBoostAmount.toLocaleString()}</span>
                      <Zap className="h-3 w-3" />
                    </div>

                    {/* Row 2, Col 2: New boost amount with increment */}
                    <div className="flex items-center gap-1 text-sm text-yellow-500">
                      <span className="font-bold">
                        {newUserBoostAmount.toLocaleString()}
                      </span>
                      <Zap className="h-3 w-3" />
                      <span className="text-xs text-green-500">
                        +{boostAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="absolute left-1/2 top-1/2 flex -translate-x-20 -translate-y-1/2 items-center justify-center">
                      <ArrowRight className="h-4 w-4 text-gray-500" />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Live values may change. Last updated on{" "}
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  -{" "}
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:flex-col">
              <Button
                onClick={handleConfirm}
                className="w-full"
                disabled={isBoosting}
              >
                CONFIRM
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex w-full items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                CHOOSE BOOST AMOUNT
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Loading */}
        {step === "loading" && (
          <div className="flex flex-col items-center justify-center space-y-6 py-8">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-yellow-500"></div>
            <div className="text-center">
              <div className="text-lg font-semibold">Processing Boost...</div>
              <div className="text-sm text-gray-400">
                Please wait while we process your boost
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center space-y-2 py-8">
            <CircleCheck className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <div className="text-secondary-foreground text-sm">
                You have successfully boosted an Agent.
              </div>
              <div className="my-6 flex items-center justify-center gap-2">
                <AgentAvatar agent={agent} size={64} />
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold">
                    +{boostAmount.toLocaleString()}
                  </span>
                  <Zap className="h-4 w-4 text-yellow-500" />
                </div>
              </div>
            </div>
            <DialogFooter className="w-full gap-2 sm:flex-col">
              <Button onClick={handleClose} className="w-full">
                BACK TO COMPETITIONS
              </Button>
              <Button
                variant="outline"
                className="flex w-full items-center gap-2"
              >
                <Share2Icon className="h-4 w-4" />
                SHARE ON X.COM
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 5: Error */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center space-y-6 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
              <X className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">Boost Failed</div>
              <div className="mt-2 text-sm text-gray-400">{error}</div>
            </div>
            <DialogFooter className="flex w-full gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                TRY AGAIN
              </Button>
              <Button onClick={handleClose} className="flex-1">
                CLOSE
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BoostAgentModal;
