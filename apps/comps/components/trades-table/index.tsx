"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";
import Tooltip from "@recallnet/ui2/components/tooltip";

import { AgentAvatar } from "@/components/agent-avatar";
import { Pagination } from "@/components/pagination";
import { PaginationResponse, Trade } from "@/types";
import { formatAmount } from "@/utils/format";

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
        header: () => <span className="font-mono font-bold">Agent</span>,
        cell: ({ row }) => (
          <Link
            href={`/agents/${row.original.agent.id}`}
            className="flex min-w-0 items-center gap-3"
          >
            <AgentAvatar agent={row.original.agent} size={32} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight">
                {row.original.agent.name}
              </span>
              <span className="text-secondary-foreground block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {row.original.agent.description || ""}
              </span>
            </div>
          </Link>
        ),
        size: 300,
      },
      {
        id: "tradeInfo",
        header: () => <span className="font-mono font-bold">Trade</span>,
        cell: ({ row }) => (
          <div>
            <div className="text-primary-foreground text-sm">
              {formatAmount(row.original.fromAmount)}{" "}
              {"$" + row.original.fromTokenSymbol} →{" "}
              {formatAmount(row.original.toAmount)}{" "}
              {"$" + row.original.toTokenSymbol}
            </div>
            <div className="text-secondary-foreground text-xs uppercase">
              {row.original.fromSpecificChain || "UNKNOWN"} →{" "}
              {row.original.toSpecificChain || "UNKNOWN"}
            </div>
          </div>
        ),
        size: 300,
      },
      {
        id: "reason",
        accessorKey: "reason",
        header: () => <span className="font-mono font-bold">Reason</span>,
        cell: ({ row }) => (
          <Tooltip
            content={row.original.reason || ""}
            tooltipClassName="w-150 max-w-150"
          >
            <div className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {row.original.reason || ""}
            </div>
          </Tooltip>
        ),
        size: 300,
        meta: {
          className: "flex-1",
        },
      },
      {
        id: "time",
        accessorKey: "timestamp",
        header: () => <span className="font-mono font-bold">Time</span>,
        cell: ({ row }) => {
          const timestamp = row.original.timestamp;
          if (!timestamp) {
            return (
              <div className="text-secondary-foreground flex flex-col items-end">
                Unknown
              </div>
            );
          }
          return (
            <div className="flex flex-col items-end">
              <span className="text-primary-foreground text-sm">
                {format(timestamp, "MMM d, yyyy")}
              </span>
              <span className="text-secondary-foreground text-xs">
                {format(timestamp, "hh:mm:ss a")}
              </span>
            </div>
          );
        },
        size: 140,
        meta: {
          className: "flex justify-end",
        },
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
      <div className="overflow-x-auto">
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
                  No trades found
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
