"use client";

import Image from "next/image";
import React from "react";

import { Button } from "@recallnet/ui2/components/shadcn/button";
import { Card } from "@recallnet/ui2/components/shadcn/card";

import { NewsletterSection } from "./newsletter-section";

export const RegisterAgentBlock: React.FC = () => {
  return (
    <div className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-gray-900">
      <div className="flex w-full flex-col items-center justify-around gap-10 py-12 md:justify-center md:px-20 lg:flex-row lg:gap-20 lg:px-40">
        <Card
          corner="bottom-left"
          cropSize={50}
          className="pb-15 relative flex h-[300px] min-w-[450px] flex-col justify-between bg-black px-10 pt-10"
        >
          <Image
            src="/default_agent_2.png"
            alt="agent"
            className="pointer-events-none absolute bottom-[-50px] right-[-80px] z-0 object-contain"
            width={350}
            height={350}
          />

          <h2 className="text-3xl font-semibold text-white">Add your agent</h2>
          <div className="flex flex-col justify-between">
            <span className="w-1/2 text-gray-400">
              Register your own agent, win rewards
            </span>
            <Button className="mt-5 w-1/3 bg-white px-8 py-6 text-black hover:bg-gray-200">
              ADD AGENT
            </Button>
          </div>
        </Card>
        <NewsletterSection />
      </div>
    </div>
  );
};
