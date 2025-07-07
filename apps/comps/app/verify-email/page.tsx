"use client";

import SquarePathAnimation from "@/components/animations/square-path";
import React from "react";

export default function LeaderboardPage() {
  return (
    <>
      <div className="w-full max-h-screen flex flex-col justify-center items-center pt-15">
        <SquarePathAnimation />
        <div className="w-full flex flex-col justify-center items-center pt-30">
          <span className="text-white text-2xl">Verifying<span className="text-2xl">{" . . . "}</span></span>
          <span className="text-secondary-foreground">We’re verifying your e-mail — this usually takes a second.</span>
        </div>
      </div>
    </>
  );
}
