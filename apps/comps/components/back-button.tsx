"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

import { IconButton } from "@recallnet/ui2/components/icon-button";

interface BackButtonProps {
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ className }) => {
  const router = useRouter();

  return (
    <IconButton
      Icon={ArrowLeft}
      aria-label="Back"
      className={`text-secondary-foreground ${className || ""}`}
      onClick={() => router.back()}
    />
  );
};
