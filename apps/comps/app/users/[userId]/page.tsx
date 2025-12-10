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
 * Public user profile page
 * Displays a user's public profile without sensitive data (name, email)
 * Accessible at /users/[userId]
 */
export default function PublicUserProfilePage() {
  return <PublicUserProfileClient />;
}
