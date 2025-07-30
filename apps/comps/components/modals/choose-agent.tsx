import {ArrowLeft, ArrowRight, Bot} from "lucide-react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import React, {useState} from "react";

import {Button} from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import {cn} from "@recallnet/ui2/lib/utils";

import {AgentCard} from "@/components/user-agents/agent-card";
import {type Agent, Competition} from "@/types";

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pathname = usePathname();

  const agentsGrouped = Array.from(
    {length: Math.ceil(agents.length / 3)},
    (_, i) => agents.slice(i * 3, i * 3 + 3),
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[850px]">
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
                className="z-10 h-10 w-10 translate-x-[20px] rounded-full p-0 hover:bg-white hover:text-black"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>

              <div className="relative flex h-80 flex-1 overflow-hidden">
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
                      {agentGroup.map((agent, j) => (
                        <AgentCard
                          key={j}
                          agent={agent}
                          nameComponent='text'
                          className="h-85 w-65 hover:scale-80 flex-shrink-0 scale-75 transition-all duration-200 hover:shadow-lg"
                          onClick={() => onContinue(agent.id)}
                        />
                      ))}
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
                className="z-10 h-10 w-10 translate-x-[-20px] rounded-full p-0 hover:bg-white hover:text-black"
              >
                <ArrowRight className="h-6 w-6" />
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
