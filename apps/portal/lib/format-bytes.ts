/**
 * Formats a byte value into a human-readable string using binary (base-2) units.
 * Uses binary prefixes (KiB, MiB, GiB, TiB) instead of SI prefixes (KB, MB, GB, TB).
 *
 * @param bytes - The number of bytes to format
 * @returns An object containing:
 *   - val: The numeric value after conversion (rounded to 2 decimal places)
 *   - unit: The unit of measurement (Bytes, KiB, MiB, GiB, TiB)
 *   - formatted: A formatted string combining the value and unit
 *
 * @example
 * ```typescript
 * formatBytes(1024) // Returns { val: 1, unit: "KiB", formatted: "1 KiB" }
 * formatBytes(1536) // Returns { val: 1.5, unit: "KiB", formatted: "1.5 KiB" }
 * ```
 *
 * @remarks
 * - Uses 1024 (2^10) as the base for conversions
 * - Rounds values to 2 decimal places
 * - Special cases:
 *   - Returns "Byte" (singular) for exactly 1 byte
 *   - Returns "Bytes" (plural) for 0 or > 1 bytes
 *
 * TODO: Convert to bigint for better precision with large numbers
 */
export function formatBytes(bytes: number) {
  const sizes = (i: number, val: number) => {
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
    if (i === 0 && val === 1) return "Byte";
    return sizes[i];
  };
  if (bytes === 0) return { val: 0, unit: "Bytes", formatted: "0 Bytes" };
  const i = Number.parseInt(
    Math.floor(Math.log(bytes) / Math.log(1024)).toString(),
  );
  const val = Math.round((bytes / Math.pow(1024, i)) * 100) / 100;
  return {
    val,
    unit: sizes(i, val),
    formatted: `${val} ${sizes(i, val)}`,
  };
}
