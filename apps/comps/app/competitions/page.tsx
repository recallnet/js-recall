import { Metadata } from "next";

import { createMetadata } from "@/lib/metadata";

import CompetitionsPageClient from "./client";

export async function generateMetadata(): Promise<Metadata> {
  return createMetadata();
}

export default function CompetitionsPage() {
  return <CompetitionsPageClient />;
}
