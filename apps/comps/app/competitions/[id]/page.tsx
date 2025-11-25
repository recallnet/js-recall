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
      return createMetadata(title, description);
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
      return (
        <NflCompetitionPage competitionId={id} competition={competition} />
      );
    }
    return <CompetitionPageClient params={params} />;
  } catch (error) {
    console.error("Failed to fetch competition:", error);
    // Fallback to default client on error
    return <CompetitionPageClient params={params} />;
  }
}
