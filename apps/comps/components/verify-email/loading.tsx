"use client";

import React from "react";

import SquarePathAnimation from "@/components/animations/square-path";

export default function LoadingVerifyEmail() {
  return (
    <>
      <div className="pt-15 flex max-h-screen w-full flex-col items-center justify-center">
        <SquarePathAnimation />
        <div className="pt-30 flex w-full flex-col items-center justify-center">
          <span className="text-2xl text-white">
            Verifying<span className="text-2xl">{" . . . "}</span>
          </span>
          <span className="text-secondary-foreground">
            We’re verifying your e-mail — this usually takes a second.
          </span>
        </div>
      </div>
    </>
  );
}
