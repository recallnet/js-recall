"use client";

import Image from "next/image";

import {cn} from "@recallnet/ui2/lib/utils";
import {InfiniteCarousel} from "../animations/carousel";

type BackedByProps = {
  className?: string;
  logos: string[]; // Array of image URLs
};

export const BackedBy: React.FC<BackedByProps> = ({className, logos}) => {
  const width = "w-full max-w-300"
  return (
    <div className={cn("flex flex-col items-center", width, className)}>
      <div className="flex flex-col">
        <h2 className="mb-8 text-5xl font-semibold text-gray-500 w-full">
          Backed by industry leaders
        </h2>
        <div className="mb-5 border-t border-gray-300" />
        <InfiniteCarousel
          items={
            logos.map((src, i) => (
              <Image
                key={i}
                src={src}
                alt={`Company logo ${i}`}
                fill
                className="object-contain"
              />
            ))
          }
          itemClassName="w-50 h-50 relative flex-shrink-0"
          speed={5}
          className={cn(width, "flex")} />
      </div>
    </div>
  );
};
