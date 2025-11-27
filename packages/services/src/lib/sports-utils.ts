/**
 * Parses a SportsDataIO UTC timestamp by appending 'Z' suffix.
 * SportsDataIO DateTimeUTC fields are in UTC but lack the 'Z' suffix.
 * @param utcTimestamp ISO timestamp string from DateTimeUTC field
 * @returns Date object in UTC
 */
export function parseUtcTimestamp(utcTimestamp: string): Date {
  return new Date(`${utcTimestamp}Z`);
}

/**
 * Converts a SportsDataIO Eastern Time timestamp to UTC.
 *
 * SportsDataIO returns most timestamps in US Eastern Time (Date, PlayTime, GameEndDateTime),
 * but also provides DateTimeUTC for game start times. We use the known Eastern/UTC pair
 * to calculate the offset (which varies between EDT and EST) and apply it.
 *
 * @param easternTimestamp ISO timestamp in Eastern Time (e.g., PlayTime, GameEndDateTime)
 * @param gameStartEastern Game start time in Eastern Time (e.g. `Score.Date` field)
 * @param gameStartUtc Game start time in UTC (e.g. `Score.DateTimeUTC` field)
 * @returns Date object in UTC
 */
export function convertEasternToUtc(
  easternTimestamp: string,
  gameStartEastern: string,
  gameStartUtc: string,
): Date {
  // Calculate the Eastern to UTC offset from the known pair (handles EDT vs EST) & apply offset
  const easternDate = new Date(`${gameStartEastern}Z`);
  const utcDate = new Date(`${gameStartUtc}Z`);
  const offsetMs = utcDate.getTime() - easternDate.getTime();
  const eastern = new Date(`${easternTimestamp}Z`);
  return new Date(eastern.getTime() + offsetMs);
}
