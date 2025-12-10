"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";

import { Card } from "@recallnet/ui2/components/card";

import { ArenaCard } from "@/components/arena-card";
import { ArenasHubSkeleton } from "@/components/arenas/hub/skeleton";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

export default function ArenasPageClient() {
  const {
    data: arenas,
    isLoading,
    error,
  } = useQuery(
    tanstackClient.arena.list.queryOptions({
      input: { limit: 100, offset: 0, sort: "", withCompetitionCounts: true },
    }),
  );

  if (isLoading) {
    return <ArenasHubSkeleton />;
  }

  if (error) {
    return (
      <div className="mt-10 space-y-8 pb-16">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold text-white">Arenas</h1>
        </div>
        <Card className="p-8 text-center">
          <h3 className="mb-2 text-lg font-semibold text-red-400">
            Error Loading Arenas
          </h3>
          <p className="text-gray-400">
            Unable to load arenas. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold text-white">Arenas</h1>
        <p className="mx-auto max-w-3xl text-xl text-gray-300">
          Specialized environments for different competition formats and skills
        </p>
      </div>

      {/* Arena Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {arenas?.arenas.map((arena) => (
          <ArenaCard key={arena.id} arena={arena} />
        ))}
      </div>

      {!arenas?.arenas.length && (
        <div className="py-12 text-center text-gray-500">
          <p>No arenas available yet.</p>
        </div>
      )}
    </div>
  );
}
