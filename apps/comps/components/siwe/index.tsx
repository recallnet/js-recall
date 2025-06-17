"use client";

import dynamic from "next/dynamic";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";

// Dynamically import the client component with no SSR to prevent hydration mismatch
const SIWEButtonClient = dynamic(
  () => import("./client").then((mod) => ({ default: mod.SIWEButtonClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full cursor-pointer items-center justify-center bg-white px-6 text-black hover:bg-gray-200">
        JOIN / SIGN IN
      </div>
    ),
  },
);

/**
 * Hydration-safe SIWE button wrapper
 * This component uses dynamic import to prevent server-side rendering
 * and avoid hydration mismatches caused by localStorage-based user state
 */
export const SIWEButton: React.FunctionComponent<
  React.ComponentProps<typeof Button>
> = (props) => {
  return <SIWEButtonClient {...props} />;
};
