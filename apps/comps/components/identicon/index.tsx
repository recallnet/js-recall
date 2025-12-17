import { identicon } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

import { cn } from "@recallnet/ui2/lib/utils";

// Brand colors (without # prefix for DiceBear - lowercase hex)
const BRAND_COLORS = {
  primary: ["0064c7", "38a430", "e5342a", "f9b700"], // Blue, Green, Red, Yellow
};

// Gradient: very sparse at top, medium toward bottom
type RowPattern =
  | "oxxxo"
  | "xxxxx"
  | "xxoxx"
  | "xooox"
  | "xoxox"
  | "oxoxo"
  | "ooxoo";
const ROW1: RowPattern[] = ["ooxoo"]; // 1 cell
const ROW2: RowPattern[] = ["ooxoo"]; // 1 cell
const ROW3: RowPattern[] = ["ooxoo", "xooox"]; // 1-2 cells
const ROW4: RowPattern[] = ["xooox", "ooxoo"]; // 1-2 cells
const ROW5: RowPattern[] = ["xooox", "oxoxo"]; // 2 cells

export function Identicon({
  address,
  className,
  size = 40,
  title,
}: {
  address: string;
  className?: string;
  size?: number;
  title?: string;
}) {
  const avatar = createAvatar(identicon, {
    seed: address,
    size: size,
    backgroundColor: ["transparent"],
    rowColor: BRAND_COLORS.primary,
    row1: ROW1,
    row2: ROW2,
    row3: ROW3,
    row4: ROW4,
    row5: ROW5,
  });

  const svg = avatar.toString();

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className={cn("rounded-full bg-transparent", className)}
      style={{
        width: size,
        height: size,
      }}
      title={title}
    />
  );
}
