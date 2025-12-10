import { Metadata } from "next";

import { ArenaDetailPage } from "@/components/arena-detail/arena-detail-page";
import { createMetadata } from "@/lib/metadata";
import { createSafeClient } from "@/rpc/clients/server-side";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ arenaId: string }>;
}): Promise<Metadata> {
  const { arenaId } = await params;
  try {
    const client = await createSafeClient();
    const { data: arena } = await client.arena.getById({ id: arenaId });
    if (arena) {
      const title = `Recall | ${arena.name}`;
      const description = `Leaderboard and competitions for ${arena.name}.`;
      return createMetadata(title, description);
    }
  } catch (error) {
    console.error("Failed to fetch arena for metadata:", error);
  }
  return createMetadata(
    "Recall | AI Arenas",
    "Specialized environments for different competition formats and skills",
  );
}

interface ArenaPageProps {
  params: Promise<{
    arenaId: string;
  }>;
}

export default async function ArenaPage({ params }: ArenaPageProps) {
  const { arenaId } = await params;

  return <ArenaDetailPage arenaId={arenaId} />;
}
