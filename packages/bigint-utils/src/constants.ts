/**
 * The number of credits required for 1 GB of storage per month.
 * This constant is used to convert between storage amounts and credit amounts.
 *
 * @remarks
 * The value is calculated as: 2,592,000,000,000,000 (2.592e15)
 * This represents the base rate for storage pricing in the Recall network.
 */
export const ONE_GB_MONTH_TO_CREDITS = 2_592_000_000_000_000;

/**
 * The conversion rate between RECALL tokens and credits.
 * This constant is used to convert between RECALL token amounts and credit amounts.
 *
 * @remarks
 * The value is 1e18, which means:
 * - 1 RECALL token = 1e18 credits
 * - 1 credit = 1e-18 RECALL tokens
 */
export const RECALL_TO_CREDIT_RATE = 1e18;
