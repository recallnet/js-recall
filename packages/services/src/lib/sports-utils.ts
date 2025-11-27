/**
 * Parses a SportsDataIO UTC timestamp by appending 'Z' suffix
 * @param utcTimestamp ISO timestamp string without timezone (from DateTimeUTC field)
 * @returns Date object representing the UTC time
 */
export function parseUtcTimestamp(utcTimestamp: string): Date {
  // SportsDataIO DateTimeUTC fields don't have 'Z' suffix but are in UTC
  return new Date(`${utcTimestamp}Z`);
}

/**
 * Converts a SportsDataIO local timestamp to UTC using a known UTC/local pair
 * SportsDataIO returns dates in US Eastern Time (aside from DateTimeUTC).
 * For fields without a UTC variant (like PlayTime, GameEndDateTime), we calculate
 * the offset from the known Date/DateTimeUTC pair and apply it.
 * @param localTimestamp ISO timestamp string in Eastern Time
 * @param referenceLocal Reference local timestamp (Date field)
 * @param referenceUtc Reference UTC timestamp (DateTimeUTC field)
 * @returns Date object representing the UTC time
 */
export function convertLocalToUtc(
  localTimestamp: string,
  referenceLocal: string,
  referenceUtc: string,
): Date {
  // Calculate offset: UTC - Local (in milliseconds)
  const localDate = new Date(`${referenceLocal}Z`);
  const utcDate = new Date(`${referenceUtc}Z`);
  const offsetMs = utcDate.getTime() - localDate.getTime();

  // Apply offset to the local timestamp
  const localTime = new Date(`${localTimestamp}Z`);
  return new Date(localTime.getTime() + offsetMs);
}
