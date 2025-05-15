"use client";

import React, { useState } from "react";

import { AddFundsStep } from "@/components/onboarding/add-funds";
import { AgentLive } from "@/components/onboarding/agent-live";
import { RegisterAgentStep } from "@/components/onboarding/register-agent";
import OnboardingScreen from "@/components/onboarding/screen";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);

  const onSubmitAgent = (args: { name: string; address: string }) => {
    console.log("AGENT CREATED", args);
    setStep((step) => step + 1);
  };

  const steps = [
    <RegisterAgentStep key="1" onSubmit={onSubmitAgent} />,
    <AddFundsStep key="2" />,
    <AgentLive key="3" />,
  ];

  return (
    <OnboardingScreen
      steps={steps}
      currentStep={step}
      onSkip={() => setStep((step) => step + 1)}
    />
  );
}
