"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";

import { AgentAvatar } from "@/components/agent-avatar";
import { Pagination } from "@/components/pagination";
import { PaginationResponse, Trade } from "@/types";

export interface TradesTableProps {
  trades: Trade[];
  pagination: PaginationResponse;
  onPageChange: (page: number) => void;
}

export const TradesTable: React.FC<TradesTableProps> = ({
  trades,
  pagination,
  onPageChange,
}) => {
  const columns = React.useMemo<ColumnDef<Trade>[]>(
    () => [
      {
        id: "agentName",
        accessorKey: "agentName",
        header: () => "Agent",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <AgentAvatar agent={row.original.agent} size={32} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight">
                {row.original.agent.name}
              </span>
              <span className="text-secondary-foreground block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {row.original.agent.description}
              </span>
            </div>
          </div>
        ),
        meta: {
          className: "flex-1",
        },
      },
      {
        id: "tradeInfo",
        header: () => "Trade",
        cell: ({ row }) => (
          <div>
            <div className="text-primary-foreground text-sm">
              {row.original.fromAmount} {row.original.fromTokenSymbol} →{" "}
              {row.original.toAmount} {row.original.toTokenSymbol}
            </div>
            <div className="text-secondary-foreground text-xs uppercase">
              {row.original.fromSpecificChain} → {row.original.toSpecificChain}
            </div>
          </div>
        ),
        size: 200,
      },
      {
        id: "reason",
        accessorKey: "reason",
        header: () => "Reason",
        cell: ({ row }) => (
          <span>
            {row.original.reason ? row.original.reason.substring(0, 300) : ""}
          </span>
        ),
        size: 300,
        meta: {
          className: "flex-1",
        },
      },
      {
        id: "time",
        accessorKey: "timestamp",
        header: () => "Time",
        cell: ({ row }) => (
          <div className="flex flex-col items-end">
            <span className="text-primary-foreground text-sm">
              {format(new Date(row.original.timestamp), "MMM d, yyyy")}
            </span>
            <span className="text-secondary-foreground text-xs">
              {format(new Date(row.original.timestamp), "hh:mm:ss a")}
            </span>
          </div>
        ),
        size: 140,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: trades,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const page =
    pagination.limit > 0
      ? Math.floor(pagination.offset / pagination.limit) + 1
      : 1;

  return (
    <div className="mt-12 w-full">
      <h2 className="mb-5 text-2xl font-bold">Trades</h2>
      <div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                style={{ display: "flex", width: "100%" }}
              >
                {headerGroup.headers.map((header) => (
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
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  style={{ display: "flex", width: "100%" }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.className}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No trades found.
                </TableCell>
              </TableRow>
            )}
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
  );
};

export default TradesTable;
