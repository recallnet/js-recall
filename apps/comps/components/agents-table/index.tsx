"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Button } from "@recallnet/ui2/components/button";
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

import { Pagination } from "@/components/pagination/index";
import { config } from "@/config/public";
import { useSession } from "@/hooks/useSession";
import { useTotalUserStaked } from "@/hooks/useStakingContract";
import { useVote } from "@/hooks/useVote";
import { openForBoosting } from "@/lib/open-for-boosting";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { RouterOutputs } from "@/rpc/router";
import { PaginationResponse } from "@/types";
import { formatCompactNumber, formatPercentage } from "@/utils/format";
import { getSortState } from "@/utils/table";

import { AgentAvatar } from "../agent-avatar";
import BoostAgentModal from "../modals/boost-agent";
import ConfirmVoteModal from "../modals/confirm-vote";
import { RankBadge } from "./rank-badge";

export interface AgentsTableProps {
  agents: RouterOutputs["competitions"]["getAgents"]["agents"];
  totalVotes: number;
  competition: RouterOutputs["competitions"]["getById"];
  onFilterChange: (filter: string) => void;
  onSortChange: (sort: string) => void;
  pagination: PaginationResponse;
  ref: React.RefObject<HTMLDivElement | null>;
  onPageChange: (page: number) => void;
}

const numberFormatter = new Intl.NumberFormat();

export const AgentsTable: React.FC<AgentsTableProps> = ({
  agents,
  totalVotes,
  competition,
  //onFilterChange,
  onSortChange,
  onPageChange,
  pagination,
  ref,
}) => {
  const session = useSession();
  const router = useRouter();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    yourShare: session.ready && session.isAuthenticated,
  });
  const [selectedAgent, setSelectedAgent] = useState<
    RouterOutputs["competitions"]["getAgents"]["agents"][number] | null
  >(null);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
  const { mutate: vote, isPending: isPendingVote } = useVote();

  const queryClient = useQueryClient();

  const { data: totalStaked } = useTotalUserStaked();

  // Boost hooks
  const {
    data: boostBalance,
    isLoading: isLoadingBoostBalance,
    isSuccess: isSuccessBoostBalance,
  } = useQuery(
    tanstackClient.boost.balance.queryOptions({
      input: { competitionId: competition.id },
      queryKey: [
        ...tanstackClient.boost.balance.queryKey({
          input: { competitionId: competition.id },
        }),
        session.user?.id ?? "unauthenticated",
      ],
      enabled: session.isAuthenticated,
      select: (data) => attoValueToNumberValue(data),
    }),
  );

  const {
    data: userBoosts,
    isLoading: isLoadingUserBoosts,
    isSuccess: isSuccessUserBoosts,
  } = useQuery(
    tanstackClient.boost.userBoosts.queryOptions({
      input: { competitionId: competition.id },
      queryKey: [
        ...tanstackClient.boost.userBoosts.queryKey({
          input: { competitionId: competition.id },
        }),
        session.user?.id ?? "unauthenticated",
      ],
      enabled: session.isAuthenticated,
      select: (data) =>
        Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            attoValueToNumberValue(value),
          ]),
        ),
    }),
  );
  const {
    data: boostTotals,
    isLoading: isLoadingBoostTotals,
    isSuccess: isSuccessBoostTotals,
  } = useQuery(
    tanstackClient.boost.agentBoostTotals.queryOptions({
      input: { competitionId: competition.id },
      select: (data) =>
        Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            attoValueToNumberValue(value),
          ]),
        ),
    }),
  );

  const { mutate: claimBoost } = useMutation(
    tanstackClient.boost.claimBoost.mutationOptions({
      onSuccess: () => {
        toast.success("Successfully claimed competition boost!");
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.balance.key(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const { mutate: claimStakedBoost } = useMutation(
    tanstackClient.boost.claimStakedBoost.mutationOptions({
      onSuccess: () => {
        toast.success("Successfully claimed competition boost!");
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.balance.key(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const isOpenForBoosting = useMemo(
    () => openForBoosting(competition),
    [competition],
  );

  const showClaimBoost = useMemo(() => {
    return (
      boostBalance === 0 &&
      Object.keys(userBoosts || {}).length === 0 &&
      isOpenForBoosting &&
      (config.publicFlags.tge ? !!totalStaked : true)
    );
  }, [boostBalance, userBoosts, isOpenForBoosting, totalStaked]);

  const showBoostBalance = useMemo(() => {
    return boostBalance !== undefined && isOpenForBoosting;
  }, [boostBalance, isOpenForBoosting]);

  const page =
    pagination.limit > 0
      ? Math.floor(pagination.offset / pagination.limit) + 1
      : 1;

  // Calculate total boost for percentage calculation
  const totalBoost = useMemo(() => {
    if (!isSuccessBoostTotals) return 0;
    return Object.values(boostTotals).reduce((sum, amount) => sum + amount, 0);
  }, [boostTotals, isSuccessBoostTotals]);

  const isLegacyCompetition = useMemo(() => {
    return competition.stats.totalVotes > 0 && competition.status === "ended";
  }, [competition.stats.totalVotes, competition.status]);

  const hasBoostEnabled = !isLegacyCompetition;

  useEffect(() => {
    setColumnVisibility({
      yourShare: session.ready && session.isAuthenticated && hasBoostEnabled,
    });
  }, [session.ready, session.isAuthenticated, hasBoostEnabled]);

  // Calculate user's total spent boost for progress bar
  const userSpentBoost = useMemo(() => {
    if (!isSuccessUserBoosts) return 0;
    return Object.values(userBoosts).reduce((sum, amount) => sum + amount, 0);
  }, [userBoosts, isSuccessUserBoosts]);

  // Calculate total boost value (available + user spent) for progress bar
  const totalBoostValue = useMemo(() => {
    const availableBalance = isSuccessBoostBalance ? boostBalance : 0;
    return availableBalance + userSpentBoost;
  }, [boostBalance, userSpentBoost, isSuccessBoostBalance]);

  // Check if boost data is loading
  const isBoostDataLoading =
    isLoadingBoostBalance || isLoadingUserBoosts || isLoadingBoostTotals;

  const handleVote = async () => {
    if (!selectedAgent) return;

    vote(
      {
        agentId: selectedAgent.id,
        competitionId: competition.id,
      },
      {
        onSuccess: () => {
          toast.success("Vote cast successfully!");
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to cast vote",
          );
        },
      },
    );
  };

  const handleClaimBoost = () => {
    if (config.publicFlags.tge) {
      claimStakedBoost({ competitionId: competition.id });
    } else {
      claimBoost({ competitionId: competition.id });
    }
  };

  const handleBoost = (
    agent: RouterOutputs["competitions"]["getAgents"]["agents"][number],
  ) => {
    setSelectedAgent(agent);
    setIsBoostModalOpen(true);
  };

  const columns = useMemo<
    ColumnDef<RouterOutputs["competitions"]["getAgents"]["agents"][number]>[]
  >(
    () => [
      {
        id: "rank",
        accessorKey: "rank",
        header: () => <span>Rank</span>,
        cell: ({ row }) =>
          row.original.rank ? <RankBadge rank={row.original.rank} /> : null,
        enableSorting: true,
        size: 100,
        sortDescFirst: false, // Start with ascending (lower ranks first)
      },
      {
        id: "name",
        accessorKey: "name",
        header: () => <span>Agent</span>,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <AgentAvatar agent={row.original} size={32} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight">
                {row.original.name}
              </span>

              <span className="text-secondary-foreground block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {row.original.description}
              </span>
            </div>
          </div>
        ),
        enableSorting: true,
        sortDescFirst: false, // Alphabetical order
        meta: {
          className: "flex-1",
        },
      },
      // Show Calmar Ratio as primary metric for perps, Portfolio Value for others
      ...(competition.type === "perpetual_futures"
        ? [
            {
              id: "calmarRatio",
              accessorKey: "calmarRatio",
              header: () => <span>Calmar Ratio</span>,
              cell: ({
                row,
              }: {
                row: {
                  original: RouterOutputs["competitions"]["getAgents"]["agents"][number];
                };
              }) => (
                <span className="text-secondary-foreground font-semibold">
                  {row.original.calmarRatio !== null &&
                  row.original.calmarRatio !== undefined
                    ? Number(row.original.calmarRatio).toFixed(2)
                    : "-"}
                </span>
              ),
              enableSorting: true,
              size: 120,
            },
            {
              id: "simpleReturn",
              accessorKey: "simpleReturn",
              header: () => (
                <span>
                  <span className="hidden sm:inline">Return %</span>
                  <span className="sm:hidden">Ret%</span>
                </span>
              ),
              cell: ({
                row,
              }: {
                row: {
                  original: RouterOutputs["competitions"]["getAgents"]["agents"][number];
                };
              }) => (
                <span
                  className={`font-semibold ${
                    row.original.simpleReturn &&
                    Number(row.original.simpleReturn) > 0
                      ? "text-green-400"
                      : row.original.simpleReturn &&
                          Number(row.original.simpleReturn) < 0
                        ? "text-red-400"
                        : "text-secondary-foreground"
                  }`}
                >
                  {row.original.simpleReturn !== null &&
                  row.original.simpleReturn !== undefined
                    ? `${(Number(row.original.simpleReturn) * 100).toFixed(2)}%`
                    : "-"}
                </span>
              ),
              enableSorting: true,
              size: 100,
            },
            {
              id: "maxDrawdown",
              accessorKey: "maxDrawdown",
              header: () => (
                <span>
                  <span className="hidden sm:inline">Max DD</span>
                  <span className="sm:hidden">DD</span>
                </span>
              ),
              cell: ({
                row,
              }: {
                row: {
                  original: RouterOutputs["competitions"]["getAgents"]["agents"][number];
                };
              }) => (
                <span className="font-semibold text-red-400">
                  {row.original.maxDrawdown !== null &&
                  row.original.maxDrawdown !== undefined
                    ? `${Math.abs(Number(row.original.maxDrawdown) * 100).toFixed(2)}%`
                    : "-"}
                </span>
              ),
              enableSorting: true,
              size: 100,
            },
          ]
        : [
            {
              id: "portfolioValue",
              accessorKey: "portfolioValue",
              header: () => <span>Portfolio</span>,
              cell: ({
                row,
              }: {
                row: {
                  original: RouterOutputs["competitions"]["getAgents"]["agents"][number];
                };
              }) => (
                <span className="text-secondary-foreground font-semibold">
                  {row.original.portfolioValue.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  })}
                </span>
              ),
              enableSorting: true,
              size: 140,
            },
            {
              id: "pnl",
              accessorKey: "pnl",
              header: () => <span>P&L</span>,
              cell: ({
                row,
              }: {
                row: {
                  original: RouterOutputs["competitions"]["getAgents"]["agents"][number];
                };
              }) => {
                const pnlColor =
                  row.original.pnlPercent >= 0
                    ? "text-green-500"
                    : "text-red-500";
                return (
                  <div className="flex flex-col">
                    <span className={`text-secondary-foreground font-semibold`}>
                      {row.original.pnlPercent >= 0 ? "+" : ""}
                      {row.original.pnl.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className={`text-xs ${pnlColor}`}>
                      ({row.original.pnlPercent >= 0 ? "+" : ""}
                      {row.original.pnlPercent.toFixed(2)}%)
                    </span>
                  </div>
                );
              },
              enableSorting: true,
              size: 140,
            },
            {
              id: "change24h",
              accessorKey: "change24h",
              header: () => <span>24h</span>,
              cell: ({
                row,
              }: {
                row: {
                  original: RouterOutputs["competitions"]["getAgents"]["agents"][number];
                };
              }) => {
                const percentColor =
                  row.original.change24hPercent >= 0
                    ? "text-green-500"
                    : "text-red-500";
                return (
                  <div className="flex flex-col font-semibold">
                    <span className={`text-xs ${percentColor}`}>
                      {row.original.change24hPercent >= 0 ? "+" : ""}
                      {row.original.change24hPercent.toFixed(2)}%
                    </span>
                  </div>
                );
              },
              enableSorting: true,
              size: 100,
            },
          ]),

      {
        id: "boostPool",
        accessorKey: "boostTotal",
        header: () => (
          <span className="whitespace-nowrap">
            {hasBoostEnabled ? "Boost Pool" : "Votes"}
          </span>
        ),
        cell: ({ row }) => {
          if (hasBoostEnabled) {
            const agentBoostTotal = isSuccessBoostTotals
              ? boostTotals[row.original.id] || 0
              : 0;

            return (
              <div className="flex flex-col items-end">
                <span className="text-secondary-foreground font-semibold">
                  {isBoostDataLoading
                    ? "..."
                    : formatCompactNumber(agentBoostTotal)}
                </span>
                <span className="text-xs text-slate-400">
                  (
                  {formatPercentage(
                    Number(agentBoostTotal),
                    Number(totalBoost),
                  )}
                  )
                </span>
              </div>
            );
          } else {
            // Show vote counts for old competitions without boost
            const voteCount = row.original.voteCount || 0;
            return (
              <div className="flex flex-col items-end">
                <span className="text-secondary-foreground font-semibold">
                  {formatCompactNumber(voteCount)}
                </span>
                <span className="text-xs text-slate-400">
                  ({formatPercentage(Number(voteCount), Number(totalVotes))})
                </span>
              </div>
            );
          }
        },
        enableSorting: false,
        size: 100,
        meta: {
          className: "flex justify-end",
        },
      },
      {
        id: "yourShare",
        header: () => <span className="whitespace-nowrap">Your Share</span>,
        cell: ({ row }) => {
          // Use user boost allocation data
          const userBoostAmount = isSuccessUserBoosts
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
                      className="hover:bg-muted h-8 w-8 rounded-lg border border-yellow-500 p-0 hover:text-white"
                      disabled={!boostBalance}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleBoost(row.original);
                      }}
                    >
                      <Zap className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-muted h-8 rounded-lg border border-yellow-500 font-bold text-white"
                    disabled={!boostBalance}
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      handleBoost(row.original);
                    }}
                  >
                    Boost{" "}
                    <Zap className="ml-1 h-4 w-4 fill-yellow-500 text-yellow-500" />
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
          className: "flex justify-end",
        },
      },
    ],
    [
      boostTotals,
      userBoosts,
      isBoostDataLoading,
      totalBoost,
      boostBalance,
      isSuccessBoostTotals,
      isOpenForBoosting,
      competition.type,
      isSuccessUserBoosts,
      hasBoostEnabled,
      totalVotes,
    ],
  );

  const table = useReactTable({
    data: agents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    manualFiltering: true,
    manualSorting: true,
    enableSorting: true,
    sortDescFirst: true, // Global default - can be overridden per column
    state: {
      sorting,
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      // Convert sorting state to server-side sort format
      // Always fall back to "rank" if no sort is explicitly set
      const sortString =
        newSorting.length > 0
          ? newSorting
              .map((sort) => `${sort.desc ? "-" : ""}${sort.id}`)
              .join(",")
          : "rank";

      onSortChange(sortString);
    },
  });

  // Virtualizer setup: show 10 rows at a time, each 64px tall
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 68, // row height
    overscan: 5,
  });

  const competitionTitles: Record<
    RouterOutputs["competitions"]["getById"]["status"],
    string
  > = {
    active: "Standings",
    ending: "Standings",
    ended: "Results",
    pending: "Signups",
  };

  return (
    <div className="mt-12 w-full" ref={ref}>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:w-1/2">
          <h2 className="text-2xl font-bold">
            Competition {competitionTitles[competition.status]}
            {/*({pagination.total})*/}
          </h2>
          {/*<div className="flex w-full items-center gap-2 rounded-2xl border px-3 py-2">
            <Search className="text-secondary-foreground mr-1 h-5" />
            <Input
              className="border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Search for an agent..."
              onChange={(e) => onFilterChange(e.target.value)}
              aria-label="Search for an agent"
            />
          </div>*/}
        </div>

        {/* Button to activate boost */}
        {showClaimBoost && (
          <Button
            size="lg"
            variant="outline"
            className="hover:bg-muted h-8 self-end rounded-lg border border-yellow-500 font-bold text-white"
            onClick={handleClaimBoost}
          >
            Start Boosting{" "}
            <Zap className="ml-1 h-4 w-4 fill-yellow-500 text-yellow-500" />
          </Button>
        )}
        {/* Available Boost Progress Bar */}
        {showBoostBalance && !showClaimBoost && (
          <div className="w-full md:w-1/2 lg:ml-8">
            <div className="rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 whitespace-nowrap text-2xl font-bold">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="font-bold">
                    {isBoostDataLoading
                      ? "..."
                      : numberFormatter.format(boostBalance || 0)}
                  </span>
                  <span className="text-secondary-foreground text-sm font-medium">
                    available
                  </span>
                </span>
                <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-yellow-500 transition-all duration-300"
                    style={{
                      width:
                        isSuccessBoostBalance &&
                        boostBalance > 0 &&
                        totalBoostValue > 0
                          ? `${Math.min(100, Number((boostBalance * 100) / totalBoostValue))}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div
        ref={tableContainerRef}
        style={{
          overflowY: "auto",
          position: "relative",
        }}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                style={{ display: "flex", width: "100%" }}
              >
                {headerGroup.headers.map((header) =>
                  header.column.getCanSort() ? (
                    <SortableTableHeader
                      key={header.id}
                      colSpan={header.colSpan}
                      sortState={getSortState(header.column.getIsSorted())}
                      style={{ width: header.getSize() }}
                      className={header.column.columnDef.meta?.className}
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
                      className={header.column.columnDef.meta?.className}
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
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              if (!row) return null;
              return (
                <TableRow
                  key={row.id}
                  style={{
                    display: "flex",
                    cursor: "pointer",
                  }}
                  ref={(el) => rowVirtualizer.measureElement(el)}
                  data-index={virtualRow.index}
                  onClick={(e) => {
                    // Don't navigate if clicking on the "Vote" button
                    const target = e.target as HTMLElement;
                    const isInteractive = target.closest(
                      'button, [type="button"]',
                    );
                    if (!isInteractive) {
                      router.push(`/agents/${row.original.id}`);
                    }
                  }}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`flex items-center ${cell.column.columnDef.meta?.className ?? ""}`}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination
        totalItems={pagination.total}
        currentPage={page}
        itemsPerPage={pagination.limit}
        onPageChange={onPageChange}
      />

      <ConfirmVoteModal
        isOpen={isVoteModalOpen}
        onClose={(open) => {
          setIsVoteModalOpen(open);
          if (!open) setSelectedAgent(null);
        }}
        agentName={selectedAgent?.name ?? ""}
        onVote={handleVote}
        isLoading={isPendingVote}
      />

      <BoostAgentModal
        isOpen={isBoostModalOpen}
        onClose={(open) => {
          setIsBoostModalOpen(open);
          if (!open) setSelectedAgent(null);
        }}
        agent={selectedAgent}
        availableBoost={boostBalance || 0}
        currentAgentBoostTotal={
          selectedAgent && isSuccessBoostTotals
            ? boostTotals[selectedAgent.id] || 0
            : 0
        }
        currentUserBoostAmount={
          selectedAgent && isSuccessUserBoosts
            ? userBoosts[selectedAgent.id] || 0
            : 0
        }
        competitionId={competition.id}
      />
    </div>
  );
};
