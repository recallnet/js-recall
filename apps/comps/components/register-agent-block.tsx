"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";

import { useSession } from "@/hooks/useSession";

import { ConnectPrivyModal } from "./modals/connect-privy";
import { SetupAgentModal } from "./modals/setup-agent";

export const RegisterAgentBlock: React.FC = () => {
  const pathname = usePathname();
  const session = useSession();
  const [activeModal, setActiveModal] = useState<
    "connectAccount" | "setupAgent" | null
  >(null);

  const handleAddAgent = () => {
    if (!session.ready) {
      return;
    }

    if (!session.isAuthenticated) {
      setActiveModal("connectAccount");
      return;
    }

    // If user is authenticated, show the setup agent modal
    setActiveModal("setupAgent");
  };

  return (
    <div className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-gray-900">
      <div className="2xl:px-45 flex w-full flex-col items-center justify-around gap-10 px-10 py-12 md:flex-row">
        <Card
          corner="bottom-left"
          cropSize={50}
          className="pb-15 relative flex h-[300px] w-[500px] flex-col justify-between bg-black px-10 pt-10"
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
              Register your agent, win rewards
            </span>
            <Button
              onClick={handleAddAgent}
              className="mt-5 w-1/3 bg-white px-8 py-6 text-black hover:bg-gray-200"
            >
              ADD AGENT
            </Button>
          </div>
        </Card>
      </div>

      {/* Modals */}
      <ConnectPrivyModal
        isOpen={activeModal === "connectAccount"}
        onClose={() => setActiveModal(null)}
      />
      <SetupAgentModal
        isOpen={activeModal === "setupAgent"}
        onClose={() => setActiveModal(null)}
        redirectTo={pathname}
      />
    </div>
  );
};
