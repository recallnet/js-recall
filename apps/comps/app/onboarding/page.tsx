"use client";

import React, {useState} from "react";
import OnboardingScreen from "@/components/onboarding/screen";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);

  const steps = [
    <div key="1">Step 1 content</div>,
    <div key="2">Step 2 content</div>,
    <div key="3">Step 3 content</div>,
  ];

  return (
    <OnboardingScreen
      steps={steps}
      currentStep={step}
      onSkip={() => console.log("Skipped onboarding")}
    />
  );
}

