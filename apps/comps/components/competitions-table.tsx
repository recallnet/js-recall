"use client";

import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useRef, useState } from "react";

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

import { PaginationResponse, UserCompetition } from "@/types";
import { getSortState } from "@/utils/table";

import { RankBadge } from "./agents-table/rank-badge";
import { CompetitionStatusBadge } from "./competition-status-badge";
import { ParticipantsAvatars } from "./participants-avatars";

export interface CompetitionsTableProps {
  competitions: UserCompetition[];
  onSortChange: (sort: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  pagination: PaginationResponse;
}

export const CompetitionsTable: React.FC<CompetitionsTableProps> = ({
  competitions,
  onSortChange,
  onLoadMore,
  hasMore,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<UserCompetition>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: () => "Competition",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-secondary-foreground font-semibold leading-tight">
              {row.original.name}
            </span>
            <span className="text-secondary-foreground/70 max-w-[200px] truncate text-xs">
              {row.original.description}
            </span>
          </div>
        ),
        enableSorting: true,
        size: 200,
      },
      {
        id: "status",
        accessorKey: "status",
        header: () => "Status",
        cell: ({ row }) => (
          <CompetitionStatusBadge status={row.original.status} />
        ),
        enableSorting: true,
        size: 120,
        meta: {
          className: "content-center",
        },
      },
      {
        id: "agent",
        header: () => "Agent",
        cell: ({ row }) => {
          const agents = row.original.agents;
          if (agents.length === 1 && agents[0]) {
            const agent = agents[0];
            return (
              <div className="flex min-w-0 items-center gap-3">
                <ParticipantsAvatars agents={[agent]} maxDisplay={1} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/agents/${agent.id}`} className="truncate">
                    <span className="text-secondary-foreground font-semibold leading-tight">
                      {agent.name}
                    </span>
                  </Link>
                  <span className="text-secondary-foreground/70 block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                    {agent.description}
                  </span>
                </div>
              </div>
            );
          } else if (agents.length > 1) {
            return <ParticipantsAvatars agents={agents} maxDisplay={3} />;
          }
        },
        enableSorting: false,
        meta: {
          className: "flex-1 content-center",
        },
      },
      {
        id: "startDate",
        accessorKey: "startDate",
        header: () => "Date",
        cell: ({ row }) => (
          <span>
            {row.original.startDate
              ? format(new Date(row.original.startDate), "MM/dd")
              : "TBA"}
          </span>
        ),
        enableSorting: true,
        meta: {
          className: "hidden lg:flex items-center",
        },
      },
      {
        id: "rank",
        header: () => "Rank",
        cell: ({ row }) => {
          const agent = row.original.agents[0];
          return agent ? (
            <RankBadge rank={agent.rank} />
          ) : (
            <span className="text-xs text-slate-400">-</span>
          );
        },
        enableSorting: false,
        size: 120,
        meta: {
          className: "content-center",
        },
      },
      {
        id: "view",
        header: () => "View",
        cell: ({ row }) => (
          <div className="flex w-full justify-center">
            <Link
              href={`/competitions/${row.original.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <SquareArrowOutUpRight
                className="text-secondary-foreground cursor-pointer hover:text-white"
                size={20}
              />
            </Link>
          </div>
        ),
        enableSorting: false,
        meta: {
          className: "content-center justify-center",
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: competitions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    manualSorting: true,
    enableSorting: true,
    state: {
      sorting,
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      const sortString = newSorting
        .map((sort) => `${sort.desc ? "-" : ""}${sort.id}`)
        .join(",");
      onSortChange(sortString);
    },
  });

  // Virtualizer setup: show 10 rows at a time, each 68px tall
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 68,
    overscan: 5,
  });

  return (
    <div className="w-full">
      <div
        ref={tableContainerRef}
        style={{
          maxHeight: "680px",
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
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                      sortState={getSortState(header.column.getIsSorted())}
                      className={header.column.columnDef.meta?.className}
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
                      style={{ width: cell.column.getSize() }}
                      className={cell.column.columnDef.meta?.className}
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
