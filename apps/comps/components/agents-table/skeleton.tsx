import React from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

export default function AgentsTableSkeleton() {
  // Number of skeleton rows to display
  const rowCount = 10;

  return (
    <div className="mt-12 w-full">
      {/* Header */}
      <div className="mb-5">
        <Skeleton className="mb-2 h-8 w-80" />
      </div>
      {/* Search bar */}
      <div className="mb-5 flex w-full items-center gap-2 rounded-2xl border px-3 py-2 md:w-1/2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-6 w-full max-w-xs" />
      </div>
      {/* Table */}
      <div
        style={{
          maxHeight: "680px",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <div className="min-w-full">
          {/* Table Header */}
          <div className="bg-muted flex w-full border-b px-2 py-3">
            <Skeleton className="mr-2 h-5 w-16" /> {/* Rank */}
            <Skeleton className="mr-2 h-5 w-40" /> {/* Agent */}
            <Skeleton className="mr-2 h-5 w-24" /> {/* Portfolio */}
            <Skeleton className="mr-2 h-5 w-20" /> {/* P&L */}
            <Skeleton className="mr-2 h-5 w-14" /> {/* 24h */}
            <Skeleton className="mr-2 h-5 w-14" /> {/* Votes */}
            <Skeleton className="h-5 w-12" /> {/* Vote button */}
          </div>
          {/* Table Rows */}
          <div className="relative">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div
                key={i}
                className="flex w-full items-center border-b px-2 py-4"
                style={{ minHeight: 68 }}
              >
                {/* Rank badge */}
                <Skeleton className="mr-2 h-8 w-12 rounded" />
                {/* Avatar + name/desc */}
                <div
                  className="mr-2 flex min-w-0 items-center"
                  style={{ width: 180 }}
                >
                  <Skeleton className="mr-3 h-8 w-8 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Skeleton className="mb-1 h-4 w-24" /> {/* Name */}
                    <Skeleton className="h-3 w-32" /> {/* Desc */}
                  </div>
                </div>
                {/* Portfolio */}
                <Skeleton className="mr-2 h-4 w-20" />
                {/* P&L */}
                <div className="mr-2 flex flex-col" style={{ width: 80 }}>
                  <Skeleton className="mb-1 h-4 w-16" />
                  <Skeleton className="h-3 w-10" />
                </div>
                {/* 24h */}
                <Skeleton className="mr-2 h-4 w-10" />
                {/* Votes */}
                <div
                  className="mr-2 flex flex-col items-end"
                  style={{ width: 40 }}
                >
                  <Skeleton className="mb-1 h-4 w-6" />
                  <Skeleton className="h-3 w-8" />
                </div>
                {/* Vote button */}
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Show More button */}
      <div className="mt-4 flex justify-center">
        <Skeleton className="h-8 w-32 rounded" />
      </div>
    </div>
  );
}
