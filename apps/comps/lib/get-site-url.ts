/**
 * Get the site URL for the site based on environment variables, with client-side support.
 */
export function getSiteUrl() {
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
    return `${process.env.NEXT_PUBLIC_FRONTEND_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return "http://localhost:3001";
}

/**
 * Get the base URL for the site based on environment variables (only server-side support).
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
    // Note: current app logic expects the protocol scheme to be included
    return process.env.NEXT_PUBLIC_FRONTEND_URL;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    // Note: Vercel does not include the protocol scheme
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  // If not set, NextJS `Metadata` defaults the base URL to the running `http://localhost:<port>`
  return "";
}
