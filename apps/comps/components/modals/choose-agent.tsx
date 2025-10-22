import { skipToken, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bot } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { cn } from "@recallnet/ui2/lib/utils";

import Tooltip from "@/../../packages/ui2/src/components/tooltip";
import { AgentCard } from "@/components/user-agents/agent-card";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

interface ChooseAgentModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  agents: RouterOutputs["user"]["getUserAgents"]["agents"];
  onContinue: (agentId: string) => void;
  competition?: RouterOutputs["competitions"]["getById"];
}

export const ChooseAgentModal: React.FC<ChooseAgentModalProps> = ({
  isOpen,
  onClose,
  agents,
  onContinue,
  competition,
}) => {
  const { data: compAgents } = useQuery(
    tanstackClient.competitions.getAgents.queryOptions({
      input: competition ? { competitionId: competition.id } : skipToken,
    }),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pathname = usePathname();

  const registered = React.useMemo(
    () =>
      compAgents?.agents.reduce(
        (acc, cur) => {
          return {
            ...acc,
            [cur.id]: true,
          };
        },
        {} as Record<string, boolean>,
      ) || {},
    [compAgents],
  );

  const agentsGrouped = Array.from(
    { length: Math.ceil(agents.length / 3) },
    (_, i) => agents.slice(i * 3, i * 3 + 3),
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-[850px] p-4 sm:p-6">
          <DialogHeader className="mb text-start">
            <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
              <Bot className="size-6 text-gray-700" />
              Choose Your Agent
            </DialogTitle>
            <DialogDescription className="pl-8 text-gray-400">
              Choose an agent to join{" "}
              <span className="text-primary-foreground">
                [{competition?.name || ""}]
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className={cn(`flex w-full flex-col justify-around`)}>
            <div className="flex items-center">
              <Button
                onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex === 0}
                variant="outline"
                className="z-10 h-8 w-8 translate-x-[10px] rounded-full p-0 hover:bg-white hover:text-black sm:h-10 sm:w-10 sm:translate-x-[20px]"
              >
                <ArrowLeft className="h-4 w-4 sm:h-6 sm:w-6" />
              </Button>

              <div className="relative flex h-60 flex-1 overflow-hidden sm:h-80">
                {agentsGrouped.map((agentGroup, i) => {
                  const currentIndex = i - selectedIndex;

                  return (
                    <div
                      key={i}
                      className="duration-600 absolute left-0 top-0 flex w-full -space-x-8 transition-transform ease-in-out"
                      style={{
                        transform: `translateX(${currentIndex * 100}%)`,
                      }}
                    >
                      {agentGroup.map((agent, j) => {
                        const isRegistered = registered[agent.id];

                        if (isRegistered)
                          return (
                            <Tooltip
                              content="Agent already registered"
                              className="translate-y-10"
                              key={j}
                            >
                              <AgentCard
                                agent={agent}
                                nameComponent="text"
                                className="sm:h-85 sm:w-65 pointer-events-none relative h-64 w-48 flex-shrink-0 translate-y-[-40px] scale-75 transition-all duration-200 hover:shadow-lg"
                                onClick={() => onContinue(agent.id)}
                              >
                                <div className="absolute z-20 h-full w-full bg-black/30"></div>
                              </AgentCard>
                            </Tooltip>
                          );

                        return (
                          <AgentCard
                            key={j}
                            agent={agent}
                            nameComponent="text"
                            className="hover:scale-80 sm:h-85 sm:w-65 h-64 w-48 flex-shrink-0 scale-75 transition-all duration-200 hover:shadow-lg"
                            onClick={() => onContinue(agent.id)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={() =>
                  setSelectedIndex(
                    Math.min(agentsGrouped.length, selectedIndex + 1),
                  )
                }
                disabled={selectedIndex == agentsGrouped.length - 1}
                variant="outline"
                className="z-10 h-8 w-8 translate-x-[-10px] rounded-full p-0 hover:bg-white hover:text-black sm:h-10 sm:w-10 sm:translate-x-[-20px]"
              >
                <ArrowRight className="h-4 w-4 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>

          <div className="flex w-full justify-center">
            <Link href={`/create-agent?redirectTo=${pathname}`}>
              <Button
                variant="outline"
                className="text-primary-foreground text-md border-0"
              >
                {"+ Register New Agent"}
              </Button>
            </Link>
          </div>

          <div className="border-t-1 border-gray-500"></div>

          <DialogFooter className="flex justify-end">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="rounded-lg border-gray-700 bg-transparent text-gray-500 hover:bg-gray-900"
                onClick={() => onClose(false)}
              >
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChooseAgentModal;
