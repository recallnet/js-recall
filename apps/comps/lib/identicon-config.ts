/**
 * DiceBear identicon configuration
 * Shared configuration for branded identicons using the Recall color palette
 */

// Brand colors for DiceBear (without # prefix - lowercase hex)
export const IDENTICON_BRAND_COLORS = {
  primary: ["0064c7", "38a430", "e5342a", "f9b700"] as string[], // Blue, Green, Red, Yellow
};

// Gradient: very sparse at top, medium toward bottom
export type RowPattern =
  | "oxxxo"
  | "xxxxx"
  | "xxoxx"
  | "xooox"
  | "xoxox"
  | "oxoxo"
  | "ooxoo";

export const ROW_PATTERNS = {
  row1: ["ooxoo"] as RowPattern[], // 1 cell
  row2: ["ooxoo"] as RowPattern[], // 1 cell
  row3: ["ooxoo", "xooox"] as RowPattern[], // 1-2 cells
  row4: ["xooox", "ooxoo"] as RowPattern[], // 1-2 cells
  row5: ["xooox", "oxoxo"] as RowPattern[], // 2 cells
} as const;
