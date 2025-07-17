"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { useAnalytics } from "@/hooks/usePostHog";

export default function SuccessVerifyEmail() {
  const router = useRouter();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    trackEvent("UserVerifiedEmail");
  }, [trackEvent]);

  React.useEffect(() => {
    const interval = setTimeout(() => router.push("/profile"), 4000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <>
      <div className="relative flex max-h-screen w-full flex-col items-center justify-center">
        <DotLottieReact
          src="https://lottie.host/71d7adab-ce72-4da1-b20a-d96019695ace/Tq7ewu1SUj.lottie"
          autoplay
          className="w-200 h-100"
        />
        <div className="flex w-full flex-col items-center justify-center">
          <span className="mb-5 text-2xl text-white">
            Email verified successfully
          </span>
          <span className="text-secondary-foreground max-w-[450px] text-center">
            You will be redirected automatically in 4 seconds, or you can
            <Link
              href="/profile"
              className="mx-1 text-gray-300 underline hover:text-white"
            >
              click here
            </Link>
            to be redirected right now.
          </span>
        </div>
      </div>
    </>
  );
}
