import { getPerformanceReport } from "./performance";

export const reports = {
  performance: getPerformanceReport,
} as const;
