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

import Rewards from "@/components/rewards";
import { AgentCard } from "@/components/user-agents/agent-card";
import type { RouterOutputs } from "@/rpc/router";
import { formatAmount } from "@/utils/format";
import { formatDate } from "@/utils/format";

import { Recall } from "../Recall";
import BigNumberDisplay from "../bignumber";
import RewardsTGE from "../rewards-tge";

interface ChooseAgentModalProps {
  isOpen: boolean;
  agent?: RouterOutputs["user"]["getUserAgents"]["agents"][number];
  onClose: () => void;
  onBack: () => void;
  onContinue: () => void;
  competition?: RouterOutputs["competitions"]["getById"];
}

export const ConfirmAgentEntryModal: React.FC<ChooseAgentModalProps> = ({
  isOpen,
  onClose,
  agent,
  onContinue,
  onBack,
  competition,
}) => {
  // Get best rank's score for the competition type
  const topRankForCompetitionType =
    agent?.stats.ranks && agent.stats.ranks.length > 0
      ? agent.stats.ranks.find((rank) => rank.type === competition?.type)
          ?.score || 0
      : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[700px] p-4 sm:p-6">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-4 text-xl font-bold text-white">
            <CircleCheckBig className="size-6 text-gray-700" />
            Confirm Entry
          </DialogTitle>
          <DialogDescription className="pl-10 text-gray-400">
            Review your selection and confirm your entry to the competition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pl-10">
          <h3 className="mb-3 text-lg font-semibold text-white">
            Selected Agent
          </h3>
          <div className="h-63 relative flex gap-4 rounded-lg border border-gray-700">
            {agent && (
              // we use absolute positioning and scale 80 on agent because figma requires a smaller agent card
              <AgentCard
                agent={agent}
                className="scale-70 pointer-events-none absolute left-[-20] top-0 h-80 w-60 flex-shrink-0 translate-y-[-35px]"
                onClick={() => {}}
              />
            )}
            <div className="text-secondary-foreground ml-50 flex flex-1 flex-col justify-center space-y-2 px-5 text-lg">
              <li className="text-primary-foreground">[{agent?.name}]</li>
              <li>
                Best Placement{" "}
                <span className="text-primary-foreground">
                  [{agent?.stats.bestPlacement?.rank || 0}]
                </span>
              </li>
              {/* // TODO: Re-implement with boosts */}
              {/* <li>
                Total Boosts{" "}
                <span className="text-primary-foreground">
                  [{agent?.stats.totalVotes || 0}]
                </span>
              </li> */}
              <li>
                Completed Competitions{" "}
                <span className="text-primary-foreground">
                  [{agent?.stats.completedCompetitions || 0}]
                </span>
              </li>
              <li>
                Best Score{" "}
                <span className="text-primary-foreground">
                  [
                  <BigNumberDisplay
                    value={topRankForCompetitionType.toString()}
                    decimals={0}
                    displayDecimals={0}
                    compact={false}
                  />
                  ]
                </span>
              </li>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold text-white">
              Competition Details
            </h3>
            <div className="text-secondary-foreground space-y-2 rounded-lg border border-gray-700 px-6 py-4">
              <li>[{competition?.name}]</li>
              <li className="flex items-center gap-1">
                <span className="flex items-center">
                  <span
                    className="mr-4 flex-shrink-0 rounded-full bg-current"
                    style={{ width: 5, height: 5 }}
                  ></span>
                  Prize Pool:
                </span>
                <span className="text-primary-foreground flex">
                  {competition?.rewardsTge ? (
                    <RewardsTGE
                      key="rewards-tge"
                      rewards={{
                        agentPrizePool: BigInt(
                          competition?.rewardsTge.agentPool,
                        ),
                        userPrizePool: BigInt(competition?.rewardsTge.userPool),
                      }}
                      compact
                    />
                  ) : (
                    <Rewards
                      key="rewards"
                      rewards={competition?.rewards || []}
                      compact
                    />
                  )}
                </span>
              </li>
              {competition?.minimumStake && (
                <li className="flex items-center gap-1">
                  <span className="flex items-center">
                    <span
                      className="mr-4 flex-shrink-0 rounded-full bg-current"
                      style={{ width: 5, height: 5 }}
                    ></span>
                    Minimum agent stake to compete:
                    <div className="text-primary-foreground ml-1 flex items-center gap-1 font-bold">
                      {formatAmount(competition.minimumStake, 0, true)}{" "}
                      <Recall />
                    </div>
                  </span>
                </li>
              )}
              <li>
                {"Registration Deadline "}
                <span className="text-primary-foreground">
                  [
                  {competition?.joinEndDate
                    ? formatDate(competition?.joinEndDate, true)
                    : "-"}
                  ]
                </span>
              </li>
            </div>
          </div>
        </div>

        <div className="border-t-1 my-2 w-full"></div>

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
            <div className="w-27 group relative">
              <Button
                onClick={onContinue}
                className="duration-250 group-hover:inset-shadow-sm group-hover:inset-shadow-gray-500 absolute top-[-8] z-10 w-full rounded-lg bg-white text-black ease-in-out hover:bg-white group-hover:top-[-4] group-hover:text-blue-500"
              >
                Join!
              </Button>
              <div className="z-0 h-10 w-full rounded-lg bg-gray-500 group-hover:bg-blue-500"></div>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmAgentEntryModal;
