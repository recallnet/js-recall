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

import { AgentAvatar } from "@/components/agent-avatar";
import { Pagination } from "@/components/pagination";
import { PaginationResponse, PerpsPosition } from "@/types";
import { formatAmount } from "@/utils/format";

export interface PositionsTableProps {
  positions: PerpsPosition[];
  pagination: PaginationResponse;
  onPageChange: (page: number) => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  pagination,
  onPageChange,
}) => {
  const columns = React.useMemo<ColumnDef<PerpsPosition>[]>(
    () => [
      {
        id: "agentName",
        accessorKey: "agentName",
        header: () => "Agent",
        cell: ({ row }) => (
          <Link
            href={`/agents/${row.original.agent?.id || row.original.agentId}`}
            className="flex min-w-0 items-center gap-3"
          >
            <AgentAvatar
              agent={
                row.original.agent
                  ? {
                      id: row.original.agent.id,
                      name: row.original.agent.name,
                      imageUrl: row.original.agent.imageUrl,
                      description: row.original.agent.description || "",
                    }
                  : {
                      id: row.original.agentId,
                      name: "Unknown Agent",
                      imageUrl: "",
                      description: "",
                    }
              }
              size={32}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-tight">
                {row.original.agent?.name || "Unknown Agent"}
              </span>
              <span className="text-secondary-foreground block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                {row.original.agent?.description || ""}
              </span>
            </div>
          </Link>
        ),
        size: 300,
      },
      {
        id: "positionInfo",
        header: () => "Position",
        cell: ({ row }) => (
          <div>
            <div className="text-primary-foreground text-sm">
              {row.original.isLong ? "LONG" : "SHORT"}{" "}
              {formatAmount(Number(row.original.positionSize))}{" "}
              {row.original.asset}
            </div>
            <div className="text-secondary-foreground text-xs">
              {row.original.leverage ? Number(row.original.leverage) : 0}x
              leverage • {formatAmount(Number(row.original.collateralAmount))}{" "}
              collateral
            </div>
          </div>
        ),
        size: 300,
        meta: {
          className: "flex-1",
        },
      },
      {
        id: "prices",
        header: () => "Prices",
        cell: ({ row }) => (
          <div>
            <div className="text-secondary-foreground text-xs">
              Entry: ${formatAmount(Number(row.original.entryPrice))}
            </div>
            <div className="text-secondary-foreground text-xs">
              Mark: $
              {formatAmount(
                row.original.currentPrice
                  ? Number(row.original.currentPrice)
                  : 0,
              )}
            </div>
            {row.original.liquidationPrice && (
              <div className="text-secondary-foreground text-xs">
                Liq: ${formatAmount(Number(row.original.liquidationPrice))}
              </div>
            )}
          </div>
        ),
        size: 200,
      },
      {
        id: "pnl",
        header: () => "PnL",
        cell: ({ row }) => {
          const pnl = row.original.pnlUsdValue
            ? Number(row.original.pnlUsdValue)
            : 0;
          const pnlPercent = row.original.pnlPercentage
            ? Number(row.original.pnlPercentage)
            : 0;
          const isPositive = pnl >= 0;

          return (
            <div className="flex flex-col">
              <span
                className={`text-sm font-medium ${
                  isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {isPositive ? "+" : ""}
                {formatAmount(pnl)} USD
              </span>
              <span
                className={`text-xs ${
                  isPositive ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {pnlPercent.toFixed(2)}%
              </span>
            </div>
          );
        },
        size: 180,
      },
      {
        id: "status",
        header: () => "Status",
        cell: ({ row }) => {
          const status = row.original.status || "Open";
          const statusColors: Record<string, string> = {
            Open: "text-green-500",
            Closed: "text-gray-500",
            Liquidated: "text-red-500",
          };

          return (
            <div className="flex flex-col">
              <span
                className={`text-sm font-medium ${
                  statusColors[status] || "text-gray-500"
                }`}
              >
                {status}
              </span>
              <span className="text-secondary-foreground text-xs">
                {format(new Date(row.original.createdAt), "MMM d, HH:mm")}
              </span>
            </div>
          );
        },
        size: 160,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: positions,
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
      <h2 className="mb-5 text-2xl font-bold">Open Positions</h2>
      <div className="overflow-x-auto">
        <Table className="min-w-full">
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
                  No positions found
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

export default PositionsTable;
