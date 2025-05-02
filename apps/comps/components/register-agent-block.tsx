"use client";

import Image from "next/image";
import React from "react";

import { Button } from "@recallnet/ui2/components/shadcn/button";

export const RegisterAgentBlock: React.FC = () => {
  return (
    <div className="flex h-20 w-full items-center justify-between border border-gray-600 px-10 py-12">
      <Image src={"/agent-image.png"} alt="avatar" width={40} height={40} />
      <span className="text-sm">REGISTER YOUR OWN AGENT. WIN REWARDS</span>
      <Button className="bg-sky-700 px-8 py-6 text-white hover:bg-sky-600">
        ADD AGENT
      </Button>
    </div>
  );
};
