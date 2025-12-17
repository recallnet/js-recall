import { formatDate } from "@/utils/format";

/**
 * Progress calculation result for time-based progress bars
 */
export interface TimeProgressResult {
  progress: number;
  progressText: string;
  startDateFormatted: string;
  endDateFormatted: string;
  startDateISO: string;
  endDateISO: string;
}

/**
 * Calculates progress between two timestamps
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds
 * @param now - Current timestamp in seconds
 * @param completedText - Text to display when progress is complete
 * @returns Progress calculation result
 */
export function calculateTimeProgress(
  startTime: bigint,
  endTime: bigint,
  now: bigint,
  completedText: string,
): TimeProgressResult {
  const isComplete = now >= endTime;

  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const totalSeconds = Number(endTime - startTime);
  const elapsedSeconds = Number(now - startTime);
  const progress = isComplete
    ? 100
    : clamp((elapsedSeconds / totalSeconds) * 100);

  const totalDays = Math.ceil(totalSeconds / (24 * 60 * 60));
  const elapsedDays = Math.max(0, Math.floor(elapsedSeconds / (24 * 60 * 60)));
  const progressText = isComplete
    ? completedText
    : `${elapsedDays}/${totalDays} days`;

  return {
    progress,
    progressText,
    startDateFormatted: formatDate(new Date(Number(startTime) * 1000)),
    endDateFormatted: formatDate(new Date(Number(endTime) * 1000)),
    startDateISO: new Date(Number(startTime) * 1000).toISOString(),
    endDateISO: new Date(Number(endTime) * 1000).toISOString(),
  };
}
