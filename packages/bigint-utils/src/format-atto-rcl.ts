import * as dn from "dnum";

/**
 * Options for formatting atto RCL values.
 */
export interface FormatAttoRclOptions {
  /**
   * The number of decimal places to use when converting from atto RCL.
   * @default 18
   */
  decimals?: number;

  /**
   * The number of decimal places to show in the formatted output.
   * @default 2
   */
  precision?: number;
}

/**
 * Formats an atto RCL value into a human-readable string with the specified precision.
 *
 * This function converts atto RCL (the smallest unit of RECALL tokens, where 1 RECALL = 10^18 atto RCL)
 * into a human-readable decimal string representation.
 *
 * @example
 * ```typescript
 * // Format 1.5 RECALL (1.5 * 10^18 atto RCL)
 * formatAttoRcl("1500000000000000000")
 * // Returns: "1.50"
 *
 * // Format with custom precision
 * formatAttoRcl("1234567890000000000", { precision: 4 })
 * // Returns: "1.2346"
 * ```
 *
 * @param attoRcl - The atto RCL amount to format
 * @param options - Optional formatting configuration
 * @returns A formatted string representation of the RECALL token amount
 */
export function formatAttoRcl(
  attoRcl: dn.Numberish,
  options?: FormatAttoRclOptions,
) {
  const val = dn.from(attoRcl, options?.decimals ?? 18);
  return dn.format(val, options?.precision ?? 2);
}
