import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
import { useTotalUserStaked } from "@/hooks/staking";
import { useSession } from "@/hooks/useSession";
import { openForBoosting } from "@/lib/open-for-boosting";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { RouterOutputs } from "@/rpc/router";
import { PaginationResponse } from "@/types";
import { checkIsPerpsCompetition } from "@/utils/competition-utils";
import { formatCompactNumber, formatPercentage } from "@/utils/format";
import { getSortState } from "@/utils/table";

import { AgentAvatar } from "../agent-avatar";
import BoostAgentModal from "../modals/boost-agent";
import { RewardsTGE } from "../rewards-tge";
import { boostedCompetitionsStartDate } from "../timeline-chart/constants";
import { RankBadge } from "./rank-badge";

export interface AgentsTableProps {
  agents: RouterOutputs["competitions"]["getAgents"]["agents"];
  competition: RouterOutputs["competitions"]["getById"];
  onSortChange: (sort: string) => void;
  pagination: PaginationResponse;
  ref: React.RefObject<HTMLDivElement | null>;
  onPageChange: (page: number) => void;
}

const numberFormatter = new Intl.NumberFormat();

export const AgentsTable: React.FC<AgentsTableProps> = ({
  agents,
  competition,
  //onFilterChange,
  onSortChange,
  onPageChange,
  pagination,
  ref,
}) => {
  const isBoostEnabled = useMemo(() => {
    return (
      !!competition.startDate &&
      competition.startDate > boostedCompetitionsStartDate
    );
  }, [competition]);
  const session = useSession();
  const router = useRouter();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    yourShare: isBoostEnabled && session.ready && session.isAuthenticated,
    boostPool: isBoostEnabled,
  });

  // Track screen size for responsive column visibility
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [selectedAgent, setSelectedAgent] = useState<
    RouterOutputs["competitions"]["getAgents"]["agents"][number] | null
  >(null);
  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: totalStaked } = useTotalUserStaked();

  // Boost hooks

  const isOpenForBoosting = useMemo(
    () => openForBoosting(competition),
    [competition],
  );

  const { data: availableBoostAwards } = useQuery(
    tanstackClient.boost.availableAwards.queryOptions({
      input: isOpenForBoosting ? { competitionId: competition.id } : skipToken,
    }),
  );

  const {
    data: userBoostBalance,
    isLoading: isLoadingUserBoostBalance,
    isSuccess: isSuccessUserBoostBalance,
  } = useQuery(
    tanstackClient.boost.balance.queryOptions({
      input: session.isAuthenticated
        ? { competitionId: competition.id }
        : skipToken,
      queryKey: [
        ...tanstackClient.boost.balance.queryKey({
          input: { competitionId: competition.id },
        }),
        session.user?.id ?? "unauthenticated",
      ],
      select: (data) => attoValueToNumberValue(data, "ROUND_DOWN", 0),
    }),
  );

  const {
    data: userBoosts,
    isLoading: isLoadingUserBoosts,
    isSuccess: isSuccessUserBoosts,
  } = useQuery(
    tanstackClient.boost.userBoosts.queryOptions({
      input: session.isAuthenticated
        ? { competitionId: competition.id }
        : skipToken,
      queryKey: [
        ...tanstackClient.boost.userBoosts.queryKey({
          input: { competitionId: competition.id },
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
      input: { competitionId: competition.id },
      select: (data) =>
        Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            attoValueToNumberValue(value, "ROUND_DOWN", 0),
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
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.availableAwards.key({
            input: { competitionId: competition.id },
          }),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const showActivateBoost = useMemo(() => {
    if (config.publicFlags.tge) {
      return (
        isOpenForBoosting && (availableBoostAwards?.totalAwardAmount ?? 0n) > 0n
      );
    } else {
      return (
        userBoostBalance === 0 &&
        Object.keys(userBoosts || {}).length === 0 &&
        isOpenForBoosting
      );
    }
  }, [availableBoostAwards, userBoostBalance, userBoosts, isOpenForBoosting]);

  const showStakeToBoost = useMemo(() => {
    if (!config.publicFlags.tge) return false;
    return totalStaked === 0n || userBoostBalance === 0;
  }, [totalStaked, userBoostBalance]);

  const showBoostBalance = useMemo(() => {
    return userBoostBalance !== undefined && isOpenForBoosting;
  }, [userBoostBalance, isOpenForBoosting]);

  const page =
    pagination.limit > 0
      ? Math.floor(pagination.offset / pagination.limit) + 1
      : 1;

  // Calculate total boost for percentage calculation
  const totalBoost = useMemo(() => {
    if (!isSuccessAgentBoostTotals) return 0;
    return Object.values(agentBoostTotals).reduce(
      (sum, amount) => sum + amount,
      0,
    );
  }, [agentBoostTotals, isSuccessAgentBoostTotals]);

  useEffect(() => {
    setColumnVisibility((prev) => ({
      ...prev,
      yourShare: isBoostEnabled && session.ready && session.isAuthenticated,
      // Hide the following columns on mobile
      boostPool: isBoostEnabled && !isMobile,
      // Perps columns
      calmarRatio: !isMobile,
      maxDrawdown: !isMobile,
      sortinoRatio: !isMobile,
      // Trading columns
      portfolioValue: !isMobile,
      change24h: !isMobile,
    }));
  }, [session.ready, session.isAuthenticated, isBoostEnabled, isMobile]);

  // Calculate user's total spent boost for progress bar
  const userSpentBoost = useMemo(() => {
    if (!isSuccessUserBoosts) return 0;
    return Object.values(userBoosts).reduce((sum, amount) => sum + amount, 0);
  }, [userBoosts, isSuccessUserBoosts]);

  // Calculate total boost value (available + user spent) for progress bar
  const totalBoostValue = useMemo(() => {
    const availableBalance = isSuccessUserBoostBalance ? userBoostBalance : 0;
    return availableBalance + userSpentBoost;
  }, [userBoostBalance, userSpentBoost, isSuccessUserBoostBalance]);

  // Check if boost data is loading
  const isBoostDataLoading =
    isLoadingUserBoostBalance ||
    isLoadingUserBoosts ||
    isLoadingAgentBoostTotals;

  const handleStakeToBoost = () => {
    router.push("/stake");
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
          row.original.rank ? (
            <RankBadge
              rank={row.original.rank}
              showIcon={!isMobile}
              className={isMobile ? "min-w-8" : ""}
            />
          ) : null,
        enableSorting: true,
        size: isMobile ? 80 : 100,
        sortDescFirst: false, // Start with ascending (lower ranks first)
      },
      {
        id: "name",
        accessorKey: "name",
        header: () => <span>Agent</span>,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <AgentAvatar agent={row.original} size={isMobile ? 28 : 32} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight">
                {row.original.name}
              </span>

              <span className="text-secondary-foreground hidden w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs sm:block">
                {row.original.description}
              </span>
            </div>
          </div>
        ),
        enableSorting: true,
        sortDescFirst: false, // Alphabetical order
        meta: {
          className: isMobile ? "flex-1 min-w-[140px]" : "flex-1 min-w-[180px]",
          flex: true,
        },
      },
      // Show Calmar Ratio as primary metric for perps, Portfolio Value for others
      ...(checkIsPerpsCompetition(competition.type)
        ? [
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
              meta: {
                className: isMobile ? "max-w-[80px]" : "max-w-[100px]",
              },
            },
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
              id: "maxDrawdown",
              accessorKey: "maxDrawdown",
              header: () => (
                <span>
                  <span className="hidden sm:inline">Max Drawdown</span>
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
              size: 140,
              meta: {
                className: "mr-4",
              },
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
              meta: {
                className: isMobile ? "max-w-[60px]" : "max-w-[100px]",
              },
            },
          ]),

      {
        id: "boostPool",
        accessorKey: "boostTotal",
        header: () => <span className="whitespace-nowrap">Boost Pool</span>,
        cell: ({ row }) => {
          const agentBoostTotal = isSuccessAgentBoostTotals
            ? agentBoostTotals[row.original.id] || 0
            : 0;

          return (
            <div className="flex flex-col items-end">
              <span className="text-secondary-foreground font-semibold">
                {isBoostDataLoading
                  ? "..."
                  : formatCompactNumber(agentBoostTotal)}
              </span>
              <span className="text-xs text-slate-400">
                ({formatPercentage(Number(agentBoostTotal), Number(totalBoost))}
                )
              </span>
            </div>
          );
        },
        enableSorting: false,
        size: isMobile ? 75 : 100,
        meta: {
          className: "justify-end text-right",
        },
      },
      {
        id: "yourShare",
        header: () => (
          <span className="whitespace-nowrap">
            {isMobile ? "Share" : "Your Share"}
          </span>
        ),
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
                      disabled={!userBoostBalance}
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
                    className={`hover:bg-muted rounded-lg border border-yellow-500 font-bold uppercase text-white ${isMobile ? "h-7 px-2 text-xs" : "h-8"}`}
                    disabled={!userBoostBalance}
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
        size: isMobile ? 100 : 120,
        meta: {
          className: "justify-end",
        },
      },
    ],
    [
      agentBoostTotals,
      userBoosts,
      isBoostDataLoading,
      totalBoost,
      userBoostBalance,
      isSuccessAgentBoostTotals,
      isOpenForBoosting,
      isSuccessUserBoosts,
      competition.type,
      isMobile,
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left column: Title, Button, Rewards, and Balance */}
        <div className="mb-5 md:col-span-1 md:col-start-1">
          <div className="flex flex-col gap-4">
            {/* Title */}
            <h2 className="text-2xl font-bold">
              Competition {competitionTitles[competition.status]}
            </h2>

            {showBoostBalance && (
              <div className="w-full sm:w-auto">
                <div className="rounded-2xl p-0 sm:px-0 sm:py-2">
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className="flex items-center gap-2 whitespace-nowrap text-2xl font-bold">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="font-bold">
                        {isBoostDataLoading
                          ? "..."
                          : numberFormatter.format(userBoostBalance || 0)}
                      </span>
                      <span className="text-secondary-foreground text-sm font-medium">
                        available
                      </span>
                    </span>
                    <div className="bg-muted h-3 w-full overflow-hidden rounded-full sm:w-80">
                      <div
                        className="h-full rounded-full bg-yellow-500 transition-all duration-300"
                        style={{
                          width:
                            isSuccessUserBoostBalance &&
                            userBoostBalance > 0 &&
                            totalBoostValue > 0
                              ? `${Math.min(
                                  100,
                                  Number(
                                    (userBoostBalance * 100) / totalBoostValue,
                                  ),
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stake to Boost button */}
            {competition.status !== "ended" &&
              (showActivateBoost || showStakeToBoost) && (
                <div>
                  <Button
                    size="lg"
                    variant="outline"
                    className="group h-8 w-full border border-yellow-500 bg-black font-semibold uppercase text-white hover:bg-yellow-500 hover:text-black"
                    onClick={
                      showActivateBoost ? handleClaimBoost : handleStakeToBoost
                    }
                  >
                    {showActivateBoost
                      ? config.publicFlags.tge
                        ? "Activate Boost"
                        : "Start Boosting"
                      : "Stake to Boost"}{" "}
                    <Zap className="ml-1 h-4 w-4 fill-yellow-500 text-yellow-500 transition-all duration-300 ease-in-out group-hover:fill-black group-hover:text-black" />
                  </Button>
                </div>
              )}
          </div>
        </div>

        {/* Table spanning full width on mobile, right 2 columns on desktop */}
        <div className="md:col-span-2">
          <div
            ref={tableContainerRef}
            className="overflow-x-auto overflow-y-auto"
          >
            <Table className="w-full min-w-max table-auto">
              <TableHeader className="sticky top-0 z-10 bg-black">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} style={{ display: "flex" }}>
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
                      style={{ display: "flex", cursor: "pointer" }}
                      ref={(el) => rowVirtualizer.measureElement(el)}
                      data-index={virtualRow.index}
                      onClick={(e) => {
                        // Don't navigate if clicking on the "Boost" button
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
                          style={{
                            width: cell.column.getSize(),
                            minWidth: (
                              cell.column.columnDef.meta as
                                | { minWidth?: number }
                                | undefined
                            )?.minWidth,
                          }}
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
        </div>
      </div>

      <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto">
        <Table className="min-w-max table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-black">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} style={{ display: "flex" }}>
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
                  style={{ display: "flex", cursor: "pointer" }}
                  ref={(el) => rowVirtualizer.measureElement(el)}
                  data-index={virtualRow.index}
                  onClick={(e) => {
                    // Don't navigate if clicking on the "Boost" button
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
                      style={{
                        width: cell.column.getSize(),
                        minWidth: (
                          cell.column.columnDef.meta as
                            | { minWidth?: number }
                            | undefined
                        )?.minWidth,
                      }}
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

      <BoostAgentModal
        isOpen={isBoostModalOpen}
        onClose={(open) => {
          setIsBoostModalOpen(open);
          if (!open) setSelectedAgent(null);
        }}
        agent={selectedAgent}
        availableBoost={userBoostBalance || 0}
        currentAgentBoostTotal={
          selectedAgent && isSuccessAgentBoostTotals
            ? agentBoostTotals[selectedAgent.id] || 0
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
