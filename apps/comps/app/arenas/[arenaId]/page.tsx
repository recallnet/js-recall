import { Metadata } from "next";

import { ArenaDetailPage } from "@/components/arena-detail/arena-detail-page";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ arenaId: string }>;
}): Promise<Metadata> {
  const { arenaId } = await params;
  return createMetadata(
    `Arena: ${arenaId}`,
    `Arena leaderboard for ${arenaId}`,
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
