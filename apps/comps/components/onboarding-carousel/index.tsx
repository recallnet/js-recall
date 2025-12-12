"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { StepCard } from "./step-card";
import { StepIndicators } from "./step-indicators";
import { ONBOARDING_STEPS } from "./steps";

interface OnboardingCarouselProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Callback when onboarding is completed (either via SKIP, CLOSE, or BOOST NOW) */
  onComplete: () => void;
}

/** Animation variants for slide transitions */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

/**
 * Onboarding carousel modal for first-time users
 */
export const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [imageReady, setImageReady] = useState(false);

  const totalSteps = ONBOARDING_STEPS.length;

  // Note: preload all step images before showing the modal to ensure content is not blank
  useEffect(() => {
    if (!isOpen) {
      setImageReady(false);
      return;
    }

    if (ONBOARDING_STEPS.length === 0) {
      setImageReady(true);
      return;
    }

    let loadedCount = 0;
    let cancelled = false;
    const imagesToLoad = ONBOARDING_STEPS.length;

    ONBOARDING_STEPS.forEach((step) => {
      const img = new Image();
      const handleLoadOrError = (): void => {
        if (cancelled) return;
        loadedCount++;
        if (loadedCount === imagesToLoad) {
          setImageReady(true);
        }
      };
      img.onload = handleLoadOrError;
      img.onerror = handleLoadOrError;
      img.src = step.imagePath;
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const currentStepData = ONBOARDING_STEPS[currentStep];

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
      onClose();
      router.push("/competitions");
    } else {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep, onComplete, onClose, router]);

  const handleSkipFlow = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex !== currentStep) {
        setDirection(stepIndex > currentStep ? 1 : -1);
        setCurrentStep(stepIndex);
      }
    },
    [currentStep],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft" && currentStep > 0) {
        handleBack();
      } else if (event.key === "Escape") {
        handleSkipFlow();
      }
    },
    [handleNext, handleBack, handleSkipFlow, currentStep],
  );

  const secondaryButton = useMemo((): { label: string; action: () => void } => {
    if (isLastStep) {
      return { label: "CLOSE", action: handleSkipFlow };
    }
    if (isFirstStep) {
      return { label: "SKIP", action: handleSkipFlow };
    }
    return { label: "BACK", action: handleBack };
  }, [isLastStep, isFirstStep, handleSkipFlow, handleBack]);

  if (!currentStepData) {
    return null;
  }

  return (
    <Dialog
      open={isOpen && imageReady}
      onOpenChange={(open) => !open && handleSkipFlow()}
    >
      <DialogContent
        className="bg-background w-[420px] max-w-[90vw] overflow-hidden rounded-3xl border-gray-800 p-0"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Welcome to Recall</DialogTitle>
        <div className="relative min-h-[350px]">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 350, damping: 30 },
                opacity: { duration: 0.12 },
              }}
              className="absolute inset-0"
            >
              <StepCard step={currentStepData} />
            </motion.div>
          </AnimatePresence>
        </div>

        <StepIndicators
          totalSteps={totalSteps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
          className="pb-4 pt-10"
        />

        <div className="flex flex-col gap-3 px-6 pb-6">
          <Button
            onClick={handleNext}
            className="rounded-lg bg-white font-mono text-lg font-semibold uppercase tracking-wide text-black hover:bg-gray-300"
          >
            {isLastStep ? "BOOST NOW" : "NEXT"}
          </Button>

          <Button
            onClick={secondaryButton.action}
            variant="outline"
            className="rounded-lg border-gray-700 bg-transparent font-mono text-lg font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-900"
          >
            {secondaryButton.label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingCarousel;
