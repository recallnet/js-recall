"use client";

import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  SortableTableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";
import { toast } from "@recallnet/ui2/components/toast";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { BoostIcon } from "@/components/BoostIcon";
import { AgentAvatar } from "@/components/agent-avatar";
import { CompetitionStandingsDetails } from "@/components/competition-standings-details";
import BoostAgentModal from "@/components/modals/boost-agent";
import { config } from "@/config/public";
import { useNflLeaderboard } from "@/hooks/sports/useNflLeaderboard";
import { useTotalUserStaked } from "@/hooks/staking";
import { useSession } from "@/hooks/useSession";
import { openForBoosting } from "@/lib/open-for-boosting";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import type { NflGame } from "@/types/nfl";
import { formatCompactNumber, formatPercentage } from "@/utils/format";
import { getSortState } from "@/utils/table";

import { RankBadge } from "../agents-table/rank-badge";

interface NflStandingsTableProps {
  competitionId: string;
  competition: RouterOutputs["competitions"]["getById"];
  games: NflGame[];
}

const numberFormatter = new Intl.NumberFormat();
const MOBILE_BREAKPOINT = 768;
const MAX_STANDINGS_AGENTS = 100;

export function NflStandingsTable({
  competitionId,
  competition,
  games,
}: NflStandingsTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const [selectedAgent, setSelectedAgent] = useState<
    (typeof agentRows)[number] | null
  >(null);
  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rank", desc: false },
  ]);
  const [apiSort, setApiSort] = useState<string>("rank");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isOpenForBoosting = useMemo(
    () => openForBoosting(competition),
    [competition],
  );

  // Fetch leaderboard data
  const { data: leaderboardData } = useNflLeaderboard(competitionId);

  // Always fetch agents to ensure we show the full roster even if leaderboard is empty
  const {
    data: competitionAgentsData,
    isLoading: isLoadingCompetitionAgents,
    error: agentsError,
  } = useQuery(
    tanstackClient.competitions.getAgents.queryOptions({
      placeholderData: keepPreviousData,
      input: {
        competitionId,
        includeInactive: true,
        paging: {
          sort: apiSort,
          offset: 0,
          limit: MAX_STANDINGS_AGENTS,
        },
      },
      staleTime: 60 * 1000,
    }),
  );

  // Fetch predictions for every game once at the component level
  const predictionQueries = useQueries({
    queries: games.map((game) => ({
      ...tanstackClient.nfl.getPredictions.queryOptions({
        input: {
          competitionId,
          gameId: game.id,
        },
      }),
      enabled: Boolean(competitionId && game.id),
    })),
  });

  // Build a lookup map: gameId -> agentId -> latest prediction
  const predictionsByGame = useMemo(() => {
    const map = new Map<
      string,
      Map<string, { predictedWinner: string; confidence: number }>
    >();

    games.forEach((game, index) => {
      const predictionResult = predictionQueries[index];
      const predictions = predictionResult?.data?.predictions ?? [];
      const agentPredictionMap = new Map<
        string,
        { predictedWinner: string; confidence: number }
      >();

      predictions.forEach((prediction) => {
        agentPredictionMap.set(prediction.agentId, {
          predictedWinner: prediction.predictedWinner,
          confidence: prediction.confidence,
        });
      });

      map.set(game.id, agentPredictionMap);
    });

    return map;
  }, [games, predictionQueries]);

  // Fetch boost data
  const { data: userBoostBalance, isLoading: isLoadingUserBoostBalance } =
    useQuery(
      tanstackClient.boost.balance.queryOptions({
        input: session.isAuthenticated ? { competitionId } : skipToken,
        queryKey: [
          ...tanstackClient.boost.balance.queryKey({
            input: { competitionId },
          }),
          session.user?.id ?? "unauthenticated",
        ],
        select: (data) => attoValueToNumberValue(data, "ROUND_DOWN", 0),
      }),
    );

  const {
    data: userBoosts,
    isLoading: isLoadingUserBoosts,
    isSuccess: isSuccessUserBoostsBalance,
  } = useQuery(
    tanstackClient.boost.userBoosts.queryOptions({
      input: session.isAuthenticated ? { competitionId } : skipToken,
      queryKey: [
        ...tanstackClient.boost.userBoosts.queryKey({
          input: { competitionId },
        }),
        session.user?.id ?? "unauthenticated",
      ],
      select: (data) =>
        Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            attoValueToNumberValue(value, "ROUND_DOWN", 0),
          ]),
        ),
    }),
  );

  const {
    data: agentBoostTotals,
    isLoading: isLoadingAgentBoostTotals,
    isSuccess: isSuccessAgentBoostTotals,
  } = useQuery(
    tanstackClient.boost.agentBoostTotals.queryOptions({
      input: { competitionId },
      select: (data) =>
        Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            attoValueToNumberValue(value, "ROUND_DOWN", 0),
          ]),
        ),
    }),
  );

  const { data: totalStaked, isLoading: isLoadingTotalStaked } =
    useTotalUserStaked();

  const { data: availableBoostAwards } = useQuery(
    tanstackClient.boost.availableAwards.queryOptions({
      input: session.isAuthenticated ? { competitionId } : skipToken,
    }),
  );

  const { mutate: claimStakedBoost } = useMutation(
    tanstackClient.boost.claimStakedBoost.mutationOptions({
      onSuccess: () => {
        toast.success("Successfully claimed competition boost!");
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.balance.key(),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.availableAwards.key({
            input: { competitionId },
          }),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const totalBoost = useMemo(() => {
    if (!isSuccessAgentBoostTotals || !agentBoostTotals) return 0;
    return Object.values(agentBoostTotals).reduce(
      (sum, amount) => sum + amount,
      0,
    );
  }, [agentBoostTotals, isSuccessAgentBoostTotals]);

  // Calculate user's total spent boost for progress bar
  const userSpentBoost = useMemo(() => {
    if (!isSuccessUserBoostsBalance || !userBoosts) return 0;
    return Object.values(userBoosts).reduce((sum, amount) => sum + amount, 0);
  }, [userBoosts, isSuccessUserBoostsBalance]);

  // Calculate total boost value (available + user spent) for progress bar
  const totalBoostValue = useMemo(() => {
    const availableBalance = isSuccessUserBoostsBalance ? userBoostBalance : 0;
    return (availableBalance || 0) + userSpentBoost;
  }, [userBoostBalance, userSpentBoost, isSuccessUserBoostsBalance]);

  const isBoostDataLoading =
    isLoadingUserBoostBalance ||
    isLoadingUserBoosts ||
    isLoadingAgentBoostTotals ||
    isLoadingTotalStaked;

  const handleBoost = useCallback((agent: (typeof agentRows)[number]) => {
    setSelectedAgent(agent);
    setIsBoostModalOpen(true);
  }, []);

  const handleStakeToBoost = () => {
    router.push("/stake");
  };

  const handleClaimBoost = () => {
    claimStakedBoost({ competitionId });
  };

  const showActivateBoost = useMemo(() => {
    if (config.publicFlags.tge) {
      return (
        isOpenForBoosting && (availableBoostAwards?.totalAwardAmount ?? 0n) > 0n
      );
    }
    return false;
  }, [availableBoostAwards, isOpenForBoosting]);

  const showStakeToBoost = useMemo(() => {
    if (!config.publicFlags.tge) return false;
    return totalStaked === 0n || userBoostBalance === 0;
  }, [totalStaked, userBoostBalance]);

  const showBoostBalance = useMemo(() => {
    return userBoostBalance !== undefined && isOpenForBoosting;
  }, [userBoostBalance, isOpenForBoosting]);

  const leaderboardByAgentId = useMemo(() => {
    const map = new Map<
      string,
      RouterOutputs["nfl"]["getLeaderboard"]["leaderboard"][number]
    >();
    leaderboardData?.leaderboard.forEach((entry) => {
      map.set(entry.agentId, entry);
    });
    return map;
  }, [leaderboardData]);

  // Build agent rows with predictions (API handles sorting)
  const agentRows = useMemo(() => {
    const competitionAgents = competitionAgentsData?.agents ?? [];

    if (competitionAgents.length) {
      return competitionAgents.map((agent, index) => {
        const leaderboardEntry = leaderboardByAgentId.get(agent.id);
        const score =
          leaderboardEntry &&
          "averageBrierScore" in leaderboardEntry &&
          typeof leaderboardEntry.averageBrierScore === "number"
            ? leaderboardEntry.averageBrierScore
            : undefined;
        const gamesScored =
          leaderboardEntry && "gamesScored" in leaderboardEntry
            ? leaderboardEntry.gamesScored
            : 0;

        return {
          id: agent.id,
          name: agent.name ?? agent.handle ?? agent.id.slice(0, 8),
          imageUrl: agent.imageUrl,
          rank: leaderboardEntry?.rank ?? agent.rank ?? Math.max(index + 1, 1),
          score,
          gamesScored,
        };
      });
    }

    return [];
  }, [competitionAgentsData, leaderboardByAgentId]);

  const columns: ColumnDef<(typeof agentRows)[number]>[] = useMemo(
    () => [
      {
        id: "rank",
        accessorKey: "rank",
        header: () => <span>Rank</span>,
        cell: ({ row }) => (
          <div className="flex w-full items-center justify-center">
            {row.original.gamesScored > 0 ? (
              <RankBadge
                rank={row.original.rank}
                showIcon={!isMobile}
                className={isMobile ? "min-w-8" : ""}
              />
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        ),
        enableSorting: true,
        sortDescFirst: false,
        size: isMobile ? 60 : 80,
      },
      {
        id: "name",
        accessorKey: "name",
        header: () => <span className="text-left">Agent</span>,
        cell: ({ row }: { row: { original: (typeof agentRows)[number] } }) => (
          <div className="flex items-center gap-3">
            <AgentAvatar
              agent={{
                id: row.original.id,
                name: row.original.name,
                imageUrl: row.original.imageUrl,
              }}
              size={32}
            />
            <span className="font-semibold">{row.original.name}</span>
          </div>
        ),
        enableSorting: true,
        sortDescFirst: false,
        size: 200,
        meta: {
          className: "justify-start text-left",
        },
      },
      {
        id: "score",
        accessorKey: "score",
        header: () => (
          <span className="cursor-help text-right">
            <Tooltip content="Average time weighted confidence score across all completed games. Higher is better, and earlier in-game predictions are weighted more heavily.">
              Overall Score
            </Tooltip>
          </span>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {row.original.gamesScored > 0 && row.original.score !== undefined
              ? row.original.score.toFixed(3)
              : "N/A"}
          </div>
        ),
        enableSorting: true,
        size: 120,
        meta: {
          className: "justify-end text-right",
        },
      },
      ...games.map((game) => ({
        id: `game-${game.id}`,
        header: () => (
          <div className="text-center text-xs">
            <Tooltip
              content="The initial predicted winner for this game with percentage confidence."
              className="cursor-help"
            >
              <div className="font-semibold">
                {game.awayTeam} @ {game.homeTeam}
              </div>
              <div className="text-muted-foreground">Prediction</div>
            </Tooltip>
          </div>
        ),
        cell: ({ row }: { row: { original: (typeof agentRows)[number] } }) => {
          const latestPrediction = predictionsByGame
            .get(game.id)
            ?.get(row.original.id);

          if (!latestPrediction) {
            return (
              <div className="text-muted-foreground text-center text-xs">
                No prediction
              </div>
            );
          }

          return (
            <div className="text-center text-xs">
              <div className="font-semibold">
                {latestPrediction.predictedWinner}
              </div>
              <div className="text-muted-foreground">
                {(latestPrediction.confidence * 100).toFixed(0)}%
              </div>
            </div>
          );
        },
        size: 120,
        meta: {
          className: "justify-center text-center",
        },
      })),
      {
        id: "boostPool",
        accessorKey: "boostTotal",
        header: () => (
          <span className="cursor-help text-right">
            <Tooltip content="The total amount of Boost that users have signaled to support this agent.">
              Boost Pool
            </Tooltip>
          </span>
        ),
        cell: ({ row }) => {
          const agentBoostTotal =
            isSuccessAgentBoostTotals && agentBoostTotals
              ? agentBoostTotals[row.original.id] || 0
              : 0;

          return (
            <div className="flex flex-col items-end">
              {isBoostDataLoading ? (
                <>
                  <Skeleton className="mb-1 h-4 w-16 rounded-xl" />
                  <Skeleton className="h-4 w-12 rounded-xl" />
                </>
              ) : (
                <>
                  <span className="text-secondary-foreground font-semibold">
                    {formatCompactNumber(agentBoostTotal)}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({formatPercentage(agentBoostTotal, totalBoost)})
                  </span>
                </>
              )}
            </div>
          );
        },
        enableSorting: false,
        size: 100,
        meta: {
          className: "justify-end text-right",
        },
      },
      {
        id: "yourShare",
        accessorKey: "yourShare",
        header: () => (
          <span className="cursor-help text-right">
            <Tooltip content="The amount of Boost that you have used to support the agent.">
              Your Share
            </Tooltip>
          </span>
        ),
        cell: ({ row }: { row: { original: (typeof agentRows)[number] } }) => {
          const userBoostAmount =
            isSuccessUserBoostsBalance && userBoosts
              ? userBoosts[row.original.id] || 0
              : 0;
          const hasBoosted = userBoostAmount > 0;
          const formattedUserBoostAmount =
            numberFormatter.format(userBoostAmount);

          return (
            <div className="flex items-center justify-end gap-2">
              {isOpenForBoosting ? (
                hasBoosted ? (
                  <>
                    <span className="font-bold text-yellow-500">
                      {isBoostDataLoading ? "..." : formattedUserBoostAmount}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="disabled:hover:text-primary-foreground text-primary-foreground group h-8 w-full border border-yellow-500 bg-black font-bold uppercase hover:bg-yellow-500 hover:text-black"
                      disabled={!userBoostBalance}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleBoost(row.original);
                      }}
                    >
                      <BoostIcon
                        className="ml-1 size-4 text-yellow-500 transition-colors duration-300 ease-in-out group-hover:text-black group-disabled:text-yellow-500"
                        useCurrentColor
                      />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="disabled:hover:text-primary-foreground text-primary-foreground group h-8 w-full border border-yellow-500 bg-black font-bold uppercase hover:bg-yellow-500 hover:text-black"
                    disabled={!userBoostBalance}
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      handleBoost(row.original);
                    }}
                  >
                    Boost{" "}
                    <BoostIcon
                      className="ml-1 size-4 text-yellow-500 transition-colors duration-300 ease-in-out group-hover:text-black group-disabled:text-yellow-500"
                      useCurrentColor
                    />
                  </Button>
                )
              ) : (
                <span className="font-bold text-yellow-500">
                  {isBoostDataLoading ? "..." : formattedUserBoostAmount}
                </span>
              )}
            </div>
          );
        },
        size: 120,
        meta: {
          className: "justify-end",
        },
      },
    ],
    [
      games,
      predictionsByGame,
      isSuccessAgentBoostTotals,
      agentBoostTotals,
      totalBoost,
      isBoostDataLoading,
      isSuccessUserBoostsBalance,
      userBoosts,
      isOpenForBoosting,
      userBoostBalance,
      handleBoost,
      isMobile,
    ],
  );

  const table = useReactTable({
    data: agentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSorting: true,
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      // Convert sorting state to server-side sort format
      const sortString =
        newSorting.length > 0
          ? newSorting
              .map((sort) => `${sort.desc ? "-" : ""}${sort.id}`)
              .join(",")
          : "rank";

      setApiSort(sortString);
    },
    state: {
      sorting,
      columnVisibility: {
        boostPool: !isMobile,
        yourShare: session.isAuthenticated && !isMobile,
        ...games.reduce(
          (acc, game) => ({
            ...acc,
            [`game-${game.id}`]: !isMobile,
          }),
          {},
        ),
      },
    },
  });

  const competitionTitles = {
    pending: "Participants",
    active: "Standings",
    ending: "Standings",
    ended: "Results",
  };

  const isTableLoading = isLoadingCompetitionAgents && agentRows.length === 0;

  return (
    <div className="w-full">
      {/* Header section */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold">
          Competition {competitionTitles[competition.status]}
        </h2>
      </div>

      <CompetitionStandingsDetails
        competition={competition}
        showBoostBalance={showBoostBalance}
        isBoostDataLoading={isBoostDataLoading}
        isOpenForBoosting={isOpenForBoosting}
        userBoostBalance={userBoostBalance}
        isSuccessUserBoostBalance={isSuccessUserBoostsBalance}
        totalBoostValue={totalBoostValue}
        showActivateBoost={showActivateBoost}
        showStakeToBoost={showStakeToBoost}
        onClaimBoost={handleClaimBoost}
        onStakeToBoost={handleStakeToBoost}
        className="mb-8"
      />

      {/* Table */}
      <div className="border-border overflow-x-auto rounded-xl border">
        <Table className="w-full min-w-max table-auto !border-collapse">
          <TableHeader className="sticky top-0 z-10 bg-black">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) =>
                  header.column.getCanSort() ? (
                    <SortableTableHeader
                      key={header.id}
                      colSpan={header.colSpan}
                      sortState={getSortState(header.column.getIsSorted())}
                      style={{ width: header.getSize() }}
                      className={cn(
                        "table-cell",
                        header.column.columnDef.meta?.className,
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </SortableTableHeader>
                  ) : (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() }}
                      className={cn(
                        "table-cell",
                        header.column.columnDef.meta?.className,
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ),
                )}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border cursor-pointer border-t transition-colors hover:bg-white/5"
                  onClick={() => router.push(`/agents/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isTableLoading ? (
              // Show skeleton rows while loading
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className="border-border border-t"
                >
                  <TableCell className="justify-center text-center">
                    <Skeleton className="mx-auto h-8 w-16 rounded-xl" />
                  </TableCell>
                  <TableCell className="justify-start text-left">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32 rounded-xl" />
                    </div>
                  </TableCell>
                  <TableCell className="justify-end text-right">
                    <Skeleton className="ml-auto h-4 w-16 rounded-xl" />
                  </TableCell>
                  {!isMobile && (
                    <>
                      <TableCell className="justify-end text-right">
                        <Skeleton className="ml-auto h-4 w-16 rounded-xl" />
                      </TableCell>
                      {session.isAuthenticated && (
                        <TableCell className="justify-end">
                          <Skeleton className="ml-auto h-8 w-20 rounded-xl" />
                        </TableCell>
                      )}
                    </>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {agentsError ? (
                    <span className="text-red-500">
                      Failed to load agents. Please try again.
                    </span>
                  ) : (
                    "No agents found for this competition."
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Boost modal */}
      {selectedAgent && (
        <BoostAgentModal
          isOpen={isBoostModalOpen}
          onClose={(open) => {
            setIsBoostModalOpen(open);
            if (!open) setSelectedAgent(null);
          }}
          // Note: this is a hack to get the NFL agent to align with trading agent data
          agent={
            {
              id: selectedAgent.id,
              name: selectedAgent.name,
              rank: selectedAgent.rank,
              handle: selectedAgent.name,
              score: selectedAgent.score ?? null,
              description: null,
              imageUrl: null,
              portfolioValue: 0,
              active: true,
              deactivationReason: null,
              pnl: 0,
              pnlPercent: 0,
              change24h: 0,
              change24hPercent: 0,
              simpleReturn: null,
              calmarRatio: null,
              maxDrawdown: null,
              hasRiskMetrics: false,
            } satisfies RouterOutputs["competitions"]["getAgents"]["agents"][number]
          }
          availableBoost={userBoostBalance || 0}
          currentAgentBoostTotal={
            isSuccessAgentBoostTotals && agentBoostTotals
              ? agentBoostTotals[selectedAgent.id] || 0
              : 0
          }
          currentUserBoostAmount={
            isSuccessUserBoostsBalance && userBoosts
              ? userBoosts[selectedAgent.id] || 0
              : 0
          }
          competitionId={competitionId}
        />
      )}
    </div>
  );
}
