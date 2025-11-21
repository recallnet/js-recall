"use client";

import React from "react";

import { Card } from "@recallnet/ui2/components/card";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

/**
 * Loading skeleton for the Arena detail page.
 * Renders placeholders for title, metadata badges, stats, leaderboard table and competitions.
 */
export const ArenaDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb placeholder */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16 rounded" />
        <span className="text-gray-600">/</span>
        <Skeleton className="h-4 w-20 rounded" />
        <span className="text-gray-600">/</span>
        <Skeleton className="h-4 w-28 rounded" />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-72 rounded-xl" />
      </div>

      {/* Arena Metadata */}
      <Card className="border-gray-800 bg-gray-900/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-10 rounded" />
            <Skeleton className="h-6 w-28 rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12 rounded" />
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-xl" />
            ))}
          </div>
        </div>
      </Card>

      {/* Stats - Desktop */}
      <div className="hidden grid-cols-3 gap-6 md:grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Skeleton className="h-6 w-10 rounded" />
              <Skeleton className="h-8 w-16 rounded-xl" />
            </div>
            <Skeleton className="mx-auto h-4 w-24 rounded" />
          </Card>
        ))}
      </div>

      {/* Leaderboard table placeholder */}
      <Card className="p-4">
        <div className="space-y-3">
          {/* Table header */}
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-4 items-center gap-4">
              {Array.from({ length: 4 }).map((__, j) => (
                <Skeleton key={j} className="h-4 w-full rounded" />
              ))}
            </div>
          ))}
        </div>
      </Card>

      {/* Competitions skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40 rounded" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20 rounded-xl" />
                  <Skeleton className="h-6 w-24 rounded-xl" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
