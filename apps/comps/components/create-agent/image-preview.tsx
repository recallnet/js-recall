"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

interface ImagePreviewProps {
  imageUrl: string | null | undefined;
  imageValid: boolean;
}

export function ImagePreview({ imageUrl, imageValid }: ImagePreviewProps) {
  return (
    <div
      className={cn(
        "relative flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border border-dashed",
        imageUrl && !imageValid
          ? "border-red-500"
          : "border-secondary-foreground",
      )}
    >
      {imageUrl ? (
        <>
          {imageValid && (
            <Image
              src={imageUrl}
              alt="Avatar Preview"
              fill
              sizes="96px"
              className="rounded-full object-cover"
            />
          )}
          {!imageValid && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full">
              <span className="text-xs text-red-500">Invalid image</span>
            </div>
          )}
        </>
      ) : (
        <Camera className="text-secondary-foreground h-8 w-8" />
      )}
    </div>
  );
}
