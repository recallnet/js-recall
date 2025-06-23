"use client";

import { Camera } from "lucide-react";
import React, { useEffect, useState } from "react";

import { cn } from "@recallnet/ui/lib/utils";

interface ImagePreviewProps {
  imageUrl: string | null | undefined;
}

export function ImagePreview({ imageUrl }: ImagePreviewProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  return (
    <div
      className={cn(
        "relative flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border border-dashed",
        imageUrl && imageError ? "border-red-500" : "border-gray-400",
      )}
    >
      {imageUrl ? (
        <>
          {!imageError && (
            <img
              src={imageUrl}
              alt="Avatar Preview"
              className="h-full w-full rounded-full object-cover"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          )}
          {imageError && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full">
              <span className="text-xs text-red-500">Invalid image</span>
            </div>
          )}
        </>
      ) : (
        <Camera className="h-8 w-8 text-gray-400" />
      )}
    </div>
  );
}
