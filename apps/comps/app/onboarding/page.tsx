"use client";

import React, {useState} from "react";
import OnboardingScreen from "@/components/onboarding/screen";
import {RegisterAgentStep} from "@/components/onboarding/register-agent";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);

  const onSubmitAgent = (args: {name: string; address: string}) => {
    console.log('AGENT CREATED', args)
    setStep(step => step + 1)
  }

  const steps = [
    <RegisterAgentStep key='1' onSubmit={onSubmitAgent} />,
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

