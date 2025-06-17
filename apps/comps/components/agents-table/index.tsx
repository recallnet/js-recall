"use client";

import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, Search } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useRef, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Input } from "@recallnet/ui2/components/input";
import {
  SortableTableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";

import { AgentCompetition, PaginationResponse } from "@/types";
import { formatPercentage } from "@/utils/format";

import { AgentAvatar } from "../agent-avatar";
import { RankBadge } from "./rank-badge";

export interface AgentsTableProps {
  agents: AgentCompetition[];
  totalVotes?: number;
  onFilterChange: (filter: string) => void;
  onSortChange: (sort: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  pagination: PaginationResponse;
}

export const AgentsTable: React.FC<AgentsTableProps> = ({
  agents,
  totalVotes,
  onFilterChange,
  onSortChange,
  onLoadMore,
  hasMore,
  pagination,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<AgentCompetition>[]>(
    () => [
      {
        id: "rank",
        accessorKey: "position",
        header: () => "Rank",
        cell: ({ row }) => <RankBadge position={row.original.position} />,
        enableSorting: true,
        size: 100,
      },
      {
        id: "name",
        accessorKey: "name",
        header: () => "Agent",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <AgentAvatar agent={row.original} size={32} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/agents/${row.original.id}`}>
                <span className="font-semibold leading-tight">
                  {row.original.name}
                </span>
              </Link>
              <span className="text-secondary-foreground block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {row.original.description}
              </span>
            </div>
          </div>
        ),
        enableSorting: true,
        meta: {
          className: "flex-1",
        },
      },
      {
        id: "portfolio",
        accessorKey: "portfolioValue",
        header: () => "Portfolio",
        cell: ({ row }) => (
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
        header: () => "P&L",
        cell: ({ row }) => {
          const pnlColor =
            row.original.pnlPercent >= 0 ? "text-green-400" : "text-red-400";
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
        header: () => "24h",
        cell: ({ row }) => {
          const percentColor =
            row.original.change24hPercent >= 0
              ? "text-green-500"
              : "text-red-500";
          return (
            <div className="flex flex-col">
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
      {
        id: "votes",
        header: () => "Votes",
        cell: ({ row }) => (
          <div className="flex flex-col items-end">
            <span className="text-secondary-foreground font-semibold">
              {row.original.voteCount}
            </span>
            <span className="text-xs text-slate-400">
              ({formatPercentage(row.original.voteCount, totalVotes ?? 0)})
            </span>
          </div>
        ),
        enableSorting: false,
        size: 80,
      },
      {
        id: "vote",
        header: () => "Vote",
        cell: () => (
          <div className="flex w-full justify-center">
            <ArrowUp
              className="text-secondary-foreground cursor-pointer hover:text-white"
              size={20}
            />
          </div>
        ),
        size: 70,
      },
    ],
    [totalVotes],
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
    state: {
      sorting,
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      // Convert sorting state to server-side sort format
      const sortString = newSorting
        .map((sort) => `${sort.desc ? "-" : ""}${sort.id}`)
        .join(",");

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

  return (
    <div className="mt-12 w-full">
      <h2 className="mb-5 text-2xl font-bold">
        Competition Leaderboard ({pagination.total})
      </h2>
      <div className="mb-5 flex w-full items-center gap-2 rounded-2xl border px-3 py-2 md:w-1/2">
        <Search className="text-secondary-foreground mr-1 h-5" />
        <Input
          className="border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="Search for an agent..."
          onChange={(e) => onFilterChange(e.target.value)}
          aria-label="Search for an agent"
        />
      </div>
      <div
        ref={tableContainerRef}
        style={{
          maxHeight: "680px", // 10 rows × 68px height
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
                      sortState={header.column.getIsSorted() ? "asc" : "none"}
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
          <TableBody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              if (!row) return null;
              return (
                <TableRow
                  key={row.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    display: "flex",
                  }}
                  ref={(el) => rowVirtualizer.measureElement(el)}
                  data-index={virtualRow.index}
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
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            Show More
          </Button>
        </div>
      )}
    </div>
  );
};
