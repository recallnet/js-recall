"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import React from "react";

import { Button } from "@recallnet/ui2/components/shadcn/button";

export const SIWEButton: React.FunctionComponent<
  React.ComponentProps<typeof Button>
> = (props) => {
  return <ConnectButton {...props}>{props.children}</ConnectButton>;
};
