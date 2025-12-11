"use client";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { BoostIcon } from "@/components/BoostIcon";
import { RewardsTGE, SingleRewardTGEValue } from "@/components/rewards-tge";
import { RouterOutputs } from "@/rpc/router";
import {
  COMPETITION_DESCRIPTIONS,
  checkIsPerpsCompetition,
  formatCompetitionType,
} from "@/utils/competition-utils";
import { formatCompactNumber } from "@/utils/format";

interface CompetitionStandingsDetailsProps {
  competition: RouterOutputs["competitions"]["getById"];
  showBoostBalance: boolean;
  isBoostDataLoading: boolean;
  isOpenForBoosting: boolean;
  userBoostBalance?: number;
  isSuccessUserBoostBalance: boolean;
  totalBoostValue: number;
  showActivateBoost: boolean;
  showStakeToBoost: boolean;
  onClaimBoost: () => void;
  onStakeToBoost: () => void;
  className?: string;
}

const numberFormatter = new Intl.NumberFormat();

export function CompetitionStandingsDetails({
  competition,
  showBoostBalance,
  isBoostDataLoading,
  isOpenForBoosting,
  userBoostBalance,
  isSuccessUserBoostBalance,
  totalBoostValue,
  showActivateBoost,
  showStakeToBoost,
  onClaimBoost,
  onStakeToBoost,
  className,
}: CompetitionStandingsDetailsProps) {
  const isPerpsCompetition = checkIsPerpsCompetition(competition.type);

  const renderNumber = (value: number, prefix = "") => (
    <>
      <span className="hidden sm:inline">
        {prefix}
        {formatCompactNumber(value)}
      </span>
      <span className="sm:hidden">
        {prefix}
        {formatCompactNumber(value)}
      </span>
    </>
  );

  const showTradingStats = competition.type !== "sports_prediction";

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 md:items-stretch",
        {
          "sm:grid-cols-2": competition.status === "pending",
          "md:grid-cols-3": competition.status !== "pending",
        },
        className,
      )}
    >
      {/* Combined Description and Stats */}
      <div
        className={cn(
          "border-border col-span-1 flex flex-col gap-6 rounded-xl border p-4 md:grid",
          {
            "md:col-span-1 md:grid-cols-1": competition.status === "pending",
            "md:col-span-2 md:grid-cols-2": competition.status !== "pending",
          },
        )}
      >
        {/* Description */}
        <div className="flex flex-col justify-center">
          <div className="text-secondary-foreground text-sm">
            <span>
              View agent performance in this{" "}
              <Tooltip
                className="cursor-help"
                content={COMPETITION_DESCRIPTIONS[competition.type]}
              >
                <span className="text-primary-foreground font-semibold">
                  {formatCompetitionType(competition.type).toLowerCase()}
                </span>{" "}
              </Tooltip>
              competition.
              {competition.rewardsTge && " The rewards distribution is:"}
            </span>
            {/* Rewards TGE Info */}
            {competition.rewardsTge && (
              <div className="mt-4 flex flex-col gap-2">
                <Tooltip
                  className="cursor-help"
                  content={
                    <div className="text-secondary-foreground mb-4 text-sm">
                      A total of{" "}
                      <SingleRewardTGEValue
                        values={[
                          competition.rewardsTge.agentPool,
                          competition.rewardsTge.userPool,
                        ]}
                      />{" "}
                      is allocated to this competition&apos;s rewards pool.
                      Agents receive{" "}
                      <SingleRewardTGEValue
                        values={[competition.rewardsTge.agentPool]}
                      />{" "}
                      of the pool based on their performance. Boosters receive{" "}
                      <SingleRewardTGEValue
                        values={[competition.rewardsTge.userPool]}
                      />{" "}
                      of the pool derived from curated predictions. For more
                      details on the rewards distribution, see{" "}
                      <a
                        href="https://docs.recall.network/competitions/rewards"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-foreground hover:text-primary-foreground/80 font-semibold underline transition-all duration-200 ease-in-out"
                      >
                        here
                      </a>
                      .
                    </div>
                  }
                >
                  <RewardsTGE
                    rewards={{
                      agentPrizePool: BigInt(competition.rewardsTge.agentPool),
                      userPrizePool: BigInt(competition.rewardsTge.userPool),
                    }}
                  />
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {competition.status !== "pending" && (
          <>
            <hr className="border-border block md:hidden" />
            <div className="flex h-full flex-col">
              <div
                className={cn(
                  "grid h-full items-stretch gap-3",
                  showTradingStats ? "grid-cols-3" : "grid-cols-1",
                )}
              >
                <div className="flex flex-col items-center justify-center">
                  <span className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">
                    Total Agents
                  </span>
                  <div className="mt-2 text-2xl font-bold">
                    {competition.stats.totalAgents}
                  </div>
                </div>

                {showTradingStats && (
                  <>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">
                        Volume
                      </span>
                      <div className="mt-2 text-2xl font-bold">
                        {renderNumber(competition.stats.totalVolume ?? 0, "$")}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-secondary-foreground text-xs font-semibold uppercase tracking-wider">
                        {isPerpsCompetition ? "Positions" : "Trades"}
                      </span>
                      <div className="mt-2 text-2xl font-bold">
                        {renderNumber(
                          isPerpsCompetition
                            ? (competition.stats.totalPositions ?? 0)
                            : (competition.stats.totalTrades ?? 0),
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Boost Balance, if applicable */}
      {(showBoostBalance || isBoostDataLoading) && isOpenForBoosting && (
        <div className="border-border flex flex-col justify-center rounded-xl border p-4">
          <div className="text-secondary-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
            Boost Balance
          </div>
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              {/* Boost balance display */}
              {isBoostDataLoading ? (
                <>
                  <Skeleton className="h-8 w-1/2 rounded-xl" />
                  <Skeleton className="h-4 w-full rounded-full" />
                </>
              ) : (
                <>
                  <Tooltip
                    className="cursor-help"
                    content={
                      <div className="text-secondary-foreground mb-4 text-sm">
                        Users with an available Boost balance signal their
                        support for competing agents. The best predictors earn a
                        greater share of the reward pool. Learn more about Boost{" "}
                        <a
                          href="https://docs.recall.network/token/staking"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-foreground hover:text-primary-foreground/80 font-semibold underline transition-all duration-200 ease-in-out"
                        >
                          here
                        </a>
                        .
                      </div>
                    }
                  >
                    <div className="flex items-center gap-2 text-2xl font-bold">
                      <BoostIcon className="size-4" />
                      <span className="font-bold">
                        {numberFormatter.format(userBoostBalance || 0)}
                      </span>
                      <span className="text-secondary-foreground text-sm font-medium">
                        available
                      </span>
                    </div>

                    <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-yellow-500 transition-all duration-300"
                        style={{
                          width:
                            isSuccessUserBoostBalance &&
                            (userBoostBalance || 0) > 0 &&
                            totalBoostValue > 0
                              ? `${Math.min(
                                  100,
                                  Number(
                                    ((userBoostBalance || 0) * 100) /
                                      totalBoostValue,
                                  ),
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </Tooltip>
                </>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {/* "Stake to Boost" button */}
              {isBoostDataLoading ? (
                <Skeleton className="h-14 w-full rounded-xl" />
              ) : (
                (showActivateBoost || showStakeToBoost) && (
                  <div>
                    <Button
                      size="lg"
                      variant="outline"
                      className="group h-8 w-full border border-yellow-500 bg-black font-semibold uppercase text-white hover:bg-yellow-500 hover:text-black"
                      onClick={
                        showActivateBoost ? onClaimBoost : onStakeToBoost
                      }
                    >
                      <span>
                        {showActivateBoost
                          ? "Activate Boost"
                          : "Stake to Boost"}
                      </span>{" "}
                      <BoostIcon
                        className="ml-1 text-yellow-500 transition-colors duration-300 ease-in-out group-hover:text-black group-disabled:text-yellow-500"
                        useCurrentColor
                      />
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
