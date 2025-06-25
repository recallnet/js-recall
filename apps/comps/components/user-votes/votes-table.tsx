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

import { RankBadge } from "@/components/agents-table/rank-badge";
import { CompetitionStatusBadge } from "@/components/competition-status-badge";
import { ParticipantsAvatars } from "@/components/participants-avatars";
import { EnrichedVote, PaginationResponse } from "@/types";
import { getSortState } from "@/utils/table";

export interface VotesTableProps {
  votes: EnrichedVote[];
  onSortChange: (sort: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  pagination: PaginationResponse;
}

export const VotesTable: React.FC<VotesTableProps> = ({
  votes,
  onSortChange,
  onLoadMore,
  hasMore,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<EnrichedVote>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: () => "Competition",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-secondary-foreground font-semibold leading-tight">
              {row.original.competition.name}
            </span>
            <span className="text-secondary-foreground/70 max-w-[200px] truncate text-xs">
              {row.original.competition.description}
            </span>
          </div>
        ),
        enableSorting: false,
        size: 200,
      },
      {
        id: "status",
        accessorKey: "status",
        header: () => "Status",
        cell: ({ row }) => (
          <CompetitionStatusBadge status={row.original.competition.status} />
        ),
        enableSorting: false,
        size: 120,
        meta: {
          className: "content-center",
        },
      },
      {
        id: "agent",
        header: () => "Agent",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <ParticipantsAvatars agents={[row.original.agent]} maxDisplay={1} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/agents/${row.original.agent.id}`}>
                <span className="text-secondary-foreground font-semibold leading-tight">
                  {row.original.agent.name}
                </span>
              </Link>
              <span className="text-secondary-foreground/70 block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {row.original.agent.description}
              </span>
            </div>
          </div>
        ),
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
            {row.original.createdAt
              ? format(new Date(row.original.createdAt), "MM/dd")
              : "TBA"}
          </span>
        ),
        enableSorting: false,
        meta: {
          className: "hidden lg:flex items-center",
        },
      },
      {
        id: "rank",
        header: () => "Rank",
        //TODO
        cell: () => <RankBadge position={0} />,
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
              href={`/votes/${row.original.id}`}
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
    data: votes,
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
    <div className="mb-10 w-full">
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
