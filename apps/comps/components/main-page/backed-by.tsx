"use client";

import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

import { InfiniteCarousel } from "../animations/carousel";

type BackedByProps = {
  className?: string;
  logos: string[]; // Array of image URLs
};

export const BackedBy: React.FC<BackedByProps> = ({ className, logos }) => {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className={cn("flex flex-col", "w-full")}>
        <h2 className="mb-8 w-full text-5xl font-semibold text-gray-500">
          Backed by industry leaders
        </h2>
        <div className="mb-5 border-t border-gray-300" />
      </div>
      <InfiniteCarousel
        items={logos.map((src, i) => (
          <Image
            key={i}
            src={src}
            alt={`Company logo ${i}`}
            fill
            className="object-contain"
          />
        ))}
        itemClassName="w-50 h-50 relative flex-shrink-0"
        speed={5}
        className={cn("flex")}
      />
    </div>
  );
};
