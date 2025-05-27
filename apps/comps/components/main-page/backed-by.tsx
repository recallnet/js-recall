"use client";

import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

type BackedByProps = {
  className?: string;
  logos: string[]; // Array of image URLs
};

export const BackedBy: React.FC<BackedByProps> = ({ className, logos }) => {
  return (
    <div className={cn("flex w-[80%] flex-col items-center", className)}>
      <div className="flex flex-col">
        <h2 className="w-100 mb-8 text-5xl font-semibold text-gray-500 md:w-full">
          Backed by industry leaders
        </h2>
        <div className="mb-5 border-t border-gray-300" />
        <div className="flex w-full flex-wrap justify-center gap-20">
          {logos.map((src, i) => (
            <div key={i} className="w-50 h-50 relative flex-shrink-0">
              <Image
                src={src}
                alt={`Company logo ${i}`}
                fill
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
