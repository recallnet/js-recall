"use client";

import Image from "next/image";

import RecallLogo from "@/components/recall-logo";

/**
 * Maintenance mode page component
 *
 * Displays a "down for maintenance" message with the same styling as the rest of the app
 *
 * @returns Maintenance page component
 */
export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        {/* Logo section */}
        <div className="mb-8 flex w-full items-center justify-center">
          <RecallLogo color="#D2D9E1" className="mb-4" />
        </div>

        {/* Hero image - improved centering */}
        <div className="mb-12 flex w-full items-center justify-center">
          <div className="relative flex h-[450px] w-full max-w-2xl items-center justify-center">
            <Image
              src="/agents.png"
              alt="Recall Agents"
              fill
              priority
              className="mx-auto"
              style={{
                objectFit: "contain",
                mixBlendMode: "screen",
                objectPosition: "center center",
              }}
            />
          </div>
        </div>

        {/* Content section */}
        <div className="flex w-full max-w-3xl flex-col items-center gap-14">
          {/* Title section */}
          <div className="text-center">
            <h1 className="mb-3 font-['Replica_LL',sans-serif] text-4xl font-bold text-[#E9EDF1] md:text-6xl">
              Down for Maintenance
            </h1>
            <p className="mb-6 font-['Trim_Mono',monospace] text-xl font-semibold text-[#E9EDF1] md:text-2xl">
              We&apos;ll be back soon!
            </p>
            <p className="mx-auto max-w-2xl font-['Replica_LL',sans-serif] text-lg tracking-wide text-[#596E89] md:text-xl">
              We&apos;re currently performing scheduled maintenance to improve
              your experience. Please check back in a few minutes.
            </p>
          </div>

          {/* Additional info section */}
        </div>
      </div>
    </div>
  );
}
