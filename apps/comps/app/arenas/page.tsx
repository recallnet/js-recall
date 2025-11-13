import { Metadata } from "next";

import { createMetadata } from "@/lib/metadata";

import ArenasPageClient from "./client";

export async function generateMetadata(): Promise<Metadata> {
  return createMetadata(
    "Arenas",
    "Explore specialized competition arenas for different trading formats and venues",
  );
}

export default function ArenasPage() {
  return <ArenasPageClient />;
}
