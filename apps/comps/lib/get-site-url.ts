export function getSiteUrl() {
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
    return `https://${process.env.NEXT_PUBLIC_FRONTEND_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return "http://localhost:3001";
}
