"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { LabLogoProps } from "@/types/leaderboard";
import { getLabColor } from "@/utils/lab-colors";

const SIZE_CLASSES = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
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
        sizes="40px"
      />
    </div>
  );
};
