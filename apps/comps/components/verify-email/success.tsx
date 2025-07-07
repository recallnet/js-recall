"use client";

import Link from "next/link";
import React, { useRef } from "react";

export default function SuccessVerifyEmail() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoEnded = () => {
    if (videoRef.current) videoRef.current.pause();
  };

  return (
    <>
      <div className="pt-15 relative flex max-h-screen w-full flex-col items-center justify-center">
        <video
          ref={videoRef}
          width={300}
          height={300}
          src="/email-success.webm"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          className="h-auto max-w-full rounded-lg shadow-lg"
        >
          Your browser does not support the video tag.
        </video>
        <div className="flex w-full flex-col items-center justify-center">
          <span className="mb-5 text-2xl text-white">
            Email verified successfully
          </span>
          <span className="text-secondary-foreground max-w-[450px] text-center">
            You will be redirected automatically in 4 seconds, or you can
            <Link
              href="/profile"
              className="text-gray-300 underline hover:text-white"
            >
              click here
            </Link>{" "}
            to be redirected right now.
          </span>
        </div>
      </div>
    </>
  );
}
