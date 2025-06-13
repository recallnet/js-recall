import { toSvg } from "jdenticon";

import { cn } from "@recallnet/ui2/lib/utils";

export function Identicon({
  address,
  className,
  size = 40,
}: {
  address: string;
  className?: string;
  size?: number;
}) {
  const svg = toSvg(address, size, {
    padding: 0.9,
    hues: [227],
    lightness: {
      color: [0.74, 1.0],
      grayscale: [0.63, 0.82],
    },
    saturation: {
      color: 0.51,
      grayscale: 0.67,
    },
    backColor: "#0000",
  });
  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className={cn("h-10 w-10 rounded-full bg-gray-700", className)}
    />
  );
}
