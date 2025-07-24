import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
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

import { AgentCard } from "@/components/user-agents/agent-card";
import { type Agent, Competition } from "@/types";

interface ChooseAgentModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  agents: Agent[];
  onContinue: (agentId: string) => void;
  competition?: Competition;
}

export const ChooseAgentModal: React.FC<ChooseAgentModalProps> = ({
  isOpen,
  onClose,
  agents,
  onContinue,
  competition,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pathname = usePathname();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[700px]">
          <DialogHeader className="text-start">
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

          <div className={cn(`mt-5 flex w-full flex-col justify-around gap-4`)}>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 3))}
                disabled={currentIndex === 0}
                variant="outline"
                className="border-0"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <div className="flex gap-6 overflow-hidden">
                <div
                  className="flex min-w-[500px] justify-center gap-6 transition-transform duration-300 ease-in-out"
                  style={{
                    transform: `translateX(-${currentIndex * (240 + 24)}px)`,
                  }}
                >
                  {agents.map((agent, i) => (
                    <AgentCard
                      key={i}
                      agent={agent}
                      className="h-75 w-55 flex-shrink-0 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                      onClick={() => onContinue(agent.id)}
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={() =>
                  setCurrentIndex(Math.min(agents.length - 3, currentIndex + 3))
                }
                disabled={currentIndex >= agents.length - 3}
                variant="outline"
                className="border-0"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
          <div className="flex w-full justify-center">
            <Link href={`/create-agent?redirectTo=${pathname}`}>
              <Button
                variant="outline"
                className="text-primary-foreground border-0"
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
