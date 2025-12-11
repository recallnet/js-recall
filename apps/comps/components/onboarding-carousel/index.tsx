"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Dialog, DialogContent } from "@recallnet/ui2/components/dialog";

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

  // Preload all step images before showing the modal to ensure modal is not blank
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
    const imagesToLoad = ONBOARDING_STEPS.length;

    ONBOARDING_STEPS.forEach((step) => {
      const img = new Image();
      const handleLoadOrError = (): void => {
        loadedCount++;
        if (loadedCount === imagesToLoad) {
          setImageReady(true);
        }
      };
      img.onload = handleLoadOrError;
      img.onerror = handleLoadOrError;
      img.src = step.imagePath;
    });
  }, [isOpen]);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const currentStepData = ONBOARDING_STEPS[currentStep];

  const handleNext = useCallback(() => {
    if (isLastStep) {
      // "BOOST NOW" on last step - navigate to competitions
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

  // Handle keyboard navigation
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

  if (!currentStepData) {
    return null;
  }

  // Determine secondary button behavior
  const getSecondaryButton = (): { label: string; action: () => void } => {
    if (isLastStep) {
      return { label: "CLOSE", action: handleSkipFlow };
    }
    if (isFirstStep) {
      return { label: "SKIP", action: handleSkipFlow };
    }
    return { label: "BACK", action: handleBack };
  };

  const secondaryButton = getSecondaryButton();

  return (
    <Dialog
      open={isOpen && imageReady}
      onOpenChange={(open) => !open && handleSkipFlow()}
    >
      <DialogContent
        className="w-[420px] max-w-[90vw] overflow-hidden rounded-3xl border-gray-800 bg-[#0d1117] p-0"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          onClick={handleSkipFlow}
          className="absolute right-4 top-4 z-10 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          aria-label="Close onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative min-h-[400px] overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="absolute inset-0 px-6 pt-6"
            >
              <StepCard step={currentStepData} />
            </motion.div>
          </AnimatePresence>
        </div>

        <StepIndicators
          totalSteps={totalSteps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
          className="pb-6"
        />

        <div className="flex flex-col gap-3 px-6 pb-6">
          <Button
            onClick={handleNext}
            className="h-12 w-full rounded-xl bg-white text-base font-semibold text-black hover:bg-gray-100"
          >
            {isLastStep ? "BOOST NOW" : "NEXT"}
          </Button>

          <Button
            onClick={secondaryButton.action}
            variant="outline"
            className="h-12 w-full rounded-xl border-gray-700 bg-transparent text-base font-semibold text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            {secondaryButton.label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingCarousel;
