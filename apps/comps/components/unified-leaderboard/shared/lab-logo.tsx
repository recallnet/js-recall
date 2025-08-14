"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { LabLogoProps } from "@/types/unified-leaderboard";
import { getLabColor } from "@/utils/lab-colors";

const SIZE_CLASSES = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
} as const;

export const LabLogo: React.FC<LabLogoProps> = ({
  provider,
  size = "md",
  className,
  showFallback = true,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoPath = `/logos/labs/${provider.toLowerCase()}.svg`;
  const labColor = getLabColor(provider);
  const sizeClass = SIZE_CLASSES[size];

  if (logoFailed && showFallback) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full text-xs font-bold text-white",
          sizeClass,
          className,
        )}
        style={{ backgroundColor: labColor }}
        title={provider}
      >
        {provider.substring(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className={cn("relative", sizeClass, className)} title={provider}>
      <Image
        src={logoPath}
        alt={`${provider} logo`}
        fill
        className="object-contain"
        onError={() => setLogoFailed(true)}
        sizes="32px"
      />
    </div>
  );
};
