import { ChevronLeft, CircleCheckBig } from "lucide-react";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { AgentCard } from "@/components/user-agents/agent-card";
import { type Agent, Competition } from "@/types";
import { formatDate } from "@/utils/format";

interface ChooseAgentModalProps {
  isOpen: boolean;
  agent?: Agent;
  onClose: () => void;
  onBack: () => void;
  onContinue: () => void;
  competition?: Competition;
}

export const ConfirmAgentEntryModal: React.FC<ChooseAgentModalProps> = ({
  isOpen,
  onClose,
  agent,
  onContinue,
  onBack,
  competition,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[700px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <CircleCheckBig className="size-6 text-gray-700" />
            Confirm Entry
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            Review your selection and confirm your entry to the competition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <h3 className="mb-3 text-lg font-semibold text-white">
            Selected Agent
          </h3>
          <div className="h-63 relative flex gap-4 rounded-lg border border-gray-700">
            {agent && (
              // we use absolute positioning and scale 80 on agent because figma requires a smaller agent card
              <AgentCard
                agent={agent}
                className="scale-70 absolute left-[-20] top-0 h-80 w-60 flex-shrink-0 translate-y-[-35px]"
                onClick={() => {}}
              />
            )}
            <div className="text-secondary-foreground ml-50 flex flex-1 flex-col justify-center space-y-2 px-5 text-lg text-gray-300">
              <li className="text-primary-foreground">{agent?.name}</li>
              <li>
                Best Placement{" "}
                <span className="text-primary-foreground">
                  {agent?.stats.bestPlacement?.rank || 0}
                </span>
              </li>
              <li>
                Total Votes{" "}
                <span className="text-primary-foreground">
                  {agent?.stats.totalVotes || 0}
                </span>
              </li>
              <li>
                Completed Comps{" "}
                <span className="text-primary-foreground">
                  {agent?.stats.completedCompetitions || 0}
                </span>
              </li>
              <li>
                ELO{" "}
                <span className="text-primary-foreground">
                  {agent?.stats.score || 0}
                </span>
              </li>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold text-white">
              Competition Details
            </h3>
            <div className="text-secondary-foreground space-y-2 rounded-lg border border-gray-700 px-6 py-4 text-gray-300">
              <li>{competition?.name}</li>
              {competition?.portfolioValue && (
                <li>
                  Prize Pool{" "}
                  <span className="text-primary-foreground">
                    {competition?.portfolioValue}
                  </span>
                </li>
              )}
              <li>
                {"Registration Deadline "}
                <span className="text-primary-foreground">
                  {competition?.joinEndDate
                    ? formatDate(competition?.joinEndDate)
                    : "-"}
                </span>
              </li>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end">
          <Button
            variant="outline"
            className="rounded-lg border-gray-700 bg-transparent text-gray-500 hover:bg-gray-900"
            onClick={onBack}
          >
            <ChevronLeft size={17} className="mr-2" />
            Back to Agent Selection
          </Button>
          <div className="flex items-center">
            <Button
              onClick={onContinue}
              className="rounded-lg bg-white text-black hover:bg-gray-300"
            >
              Join!
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmAgentEntryModal;
