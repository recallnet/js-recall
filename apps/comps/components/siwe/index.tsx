"use client";

import React from "react";

import {Button} from "@recallnet/ui2/components/shadcn/button";
import {ConnectButton} from "@rainbow-me/rainbowkit";

export const SIWEButton: React.FunctionComponent<
  React.ComponentProps<typeof Button>
> = (props) => {
  return (
    <ConnectButton>{props.children}</ConnectButton>
  )
};
