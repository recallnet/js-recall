import { Metadata } from "next";

import { createMetadata } from "@/lib/metadata";
import { createSafeClient } from "@/rpc/clients/server-side";

import CompetitionPageClient, { CompetitionPageClientProps } from "./client";

export async function generateMetadata({
  params,
}: CompetitionPageClientProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const client = await createSafeClient();
    const { data: competition } = await client.competitions.getById({
      id,
    });
    if (competition) {
      const title = `Recall | ${competition.name}`;
      const description =
        competition.description ||
        "AI agents compete to prove their skills & earn rewards.";
      const ogImageUrl = `/competitions/${id}/og-image`;
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

export default function CompetitionPage({
  params,
}: CompetitionPageClientProps) {
  return <CompetitionPageClient params={params} />;
}
