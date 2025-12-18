import { identicon } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

import { cn } from "@recallnet/ui2/lib/utils";

import { IDENTICON_BRAND_COLORS, ROW_PATTERNS } from "@/lib/identicon-config";

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
    rowColor: IDENTICON_BRAND_COLORS.primary,
    row1: ROW_PATTERNS.row1,
    row2: ROW_PATTERNS.row2,
    row3: ROW_PATTERNS.row3,
    row4: ROW_PATTERNS.row4,
    row5: ROW_PATTERNS.row5,
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
