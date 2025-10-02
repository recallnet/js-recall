import React from "react";

import { AssistantsIcon } from "./components/assistants";
import { CodingIcon } from "./components/coding";
import { ForecastingIcon } from "./components/forecasting";
import { ResearchIcon } from "./components/research";
import { SecurityIcon } from "./components/security";
import { StrategiesIcon } from "./components/strategies";

// Map of icon names to their component implementations
export const BuildData = {
  strategies: StrategiesIcon,
  research: ResearchIcon,
  security: SecurityIcon,
  coding: CodingIcon,
  forecasting: ForecastingIcon,
  assistants: AssistantsIcon,
};

export const BuildIcon = ({ icon }: { icon: string }) => {
  const IconComponent = BuildData[icon.toLowerCase() as keyof typeof BuildData];
  return IconComponent ? <IconComponent /> : null;
};
