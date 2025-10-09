import { Metadata } from "next";

import { createMetadata } from "@/lib/metadata";

import CompetitionPageClient, { CompetitionPageClientProps } from "./client";

export async function generateMetadata(): Promise<Metadata> {
  return createMetadata();
}

export default function CompetitionPage({
  params,
}: CompetitionPageClientProps) {
  return <CompetitionPageClient params={params} />;
}
