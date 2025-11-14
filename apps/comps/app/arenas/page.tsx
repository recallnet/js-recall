import { Metadata } from "next";

import { createMetadata } from "@/lib/metadata";

import ArenasPageClient from "./client";

export async function generateMetadata(): Promise<Metadata> {
  return createMetadata(
    "Arenas",
    "Explore specialized environments for different competition formats and skills",
  );
}

export default function ArenasPage() {
  return <ArenasPageClient />;
}
