"use client";

import React from "react";

import {ConnectButton} from "@rainbow-me/rainbowkit";

export const SIWEButton: React.FunctionComponent<
  React.ComponentProps<typeof Button>
> = (props) => {
  return (
    <ConnectButton>{props.children}</ConnectButton>
  )
};
