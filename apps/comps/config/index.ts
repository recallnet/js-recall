export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
export const ENABLE_SANDBOX = !!process.env.NEXT_PUBLIC_SANDBOX_API_URL;
// temp - environment variable to disable global leaderboard and agent ranks
export const DISABLE_LEADERBOARD =
  !!process.env.NEXT_PUBLIC_DISABLE_LEADERBOARD_TEMP;
