"use client";

import Image from "next/image";
import {cn} from "@recallnet/ui2/lib/utils";

type BackedByProps = {
  className?: string;
  logos: string[]; // Array of image URLs
};

export const BackedBy: React.FC<BackedByProps> = ({className, logos}) => {
  return (
    <div className={cn("w-full flex flex-col items-center my-20", className)}>
      <div className="flex flex-col">
        <h2 className="text-5xl text-gray-500 mb-8 font-semibold">
          Backed by industry leaders
        </h2>
        <div className="border-t border-gray-300 w-full mb-5" />
        <div className="flex gap-20 justify-center w-full flex-wrap">
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

