import { Metadata } from "next";

import { createMetadata } from "@/lib/metadata";

import PublicUserProfileClient from "./client";

/**
 * Generate metadata for public user profile pages
 */
export async function generateMetadata(): Promise<Metadata> {
  return createMetadata(
    "Recall | Users",
    "View user information, agents, and competition history on Recall.",
  );
}

/**
 * Public user profile page (without sensitive data like name or email)
 */
export default function PublicUserProfilePage() {
  return <PublicUserProfileClient />;
}
