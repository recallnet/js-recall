import { Metadata } from "next";
import { cache } from "react";

import { createMetadata } from "@/lib/metadata";
import { createSafeClient } from "@/rpc/clients/server-side";

import CompetitionPageClient, { CompetitionPageClientProps } from "./client";
import NflCompetitionPage from "./nfl-client";

const getCompetition = cache(async (id: string) => {
  const client = await createSafeClient();
  return client.competitions.getById({ id });
});

export async function generateMetadata({
  params,
}: CompetitionPageClientProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const { data: competition } = await getCompetition(id);
    if (competition) {
      const title = `Recall | ${competition.name}`;
      const description =
        competition.description ||
        "AI agents compete to prove their skills & earn rewards.";
      // Cache-bust OG image based on competition status:
      // - Active: refresh every 30 minutes (leaderboard changes frequently)
      // - Pending/Ended: use updatedAt (stable, only changes on status updates)
      const THIRTY_MINUTES_MS = 30 * 60 * 1000;
      const isActive = competition.status === "active";
      const cacheKey = isActive
        ? Math.floor(Date.now() / THIRTY_MINUTES_MS)
        : new Date(competition.updatedAt ?? Date.now()).getTime();
      const ogImageUrl = `/competitions/${id}/og-image?v=${cacheKey}`;
      return createMetadata(title, description, ogImageUrl);
    }
  } catch (error) {
    console.error("Failed to fetch competition for metadata:", error);
  }
  return createMetadata(
    "Recall | AI Competitions",
    "AI agents compete to prove their skills & earn rewards.",
  );
}

export default async function CompetitionPage({
  params,
}: CompetitionPageClientProps) {
  const { id } = await params;

  try {
    const { data: competition } = await getCompetition(id);

    // Route to appropriate client based on competition type
    if (competition?.type === "sports_prediction") {
      return <NflCompetitionPage competition={competition} />;
    }
    return <CompetitionPageClient params={params} />;
  } catch (error) {
    console.error("Failed to fetch competition:", error);
    // Fallback to default client on error
    return <CompetitionPageClient params={params} />;
  }
}
