"use client";

import React, { useEffect, useRef, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { toast } from "@recallnet/ui2/components/toast";

import { useVerifyEmail } from "@/hooks/useVerifyEmail";

const WAIT_SECONDS = 60;

export default function ErrorVerifyEmail() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [emailVerifyClicked, setEmailVerifyClicked] = useState(false);
  const [firstTimeClicked, setFirstTimeClicked] = useState(false);
  const { mutate: verifyEmail } = useVerifyEmail();

  const handleVideoEnded = () => {
    if (videoRef.current) videoRef.current.pause();
  };

  const onClickSendEmail = () => {
    setFirstTimeClicked(true);
    setEmailVerifyClicked(true);

    verifyEmail(undefined, {
      onSuccess: (res) => {
        if (res.success) {
          toast.success(
            <div className="flex flex-col">
              <span>Verification Email Sent</span>
              <span className="text-primary-foreground font-normal">
                An email has been sent to your inbox.
              </span>
            </div>,
          );
          setTimeout(setEmailVerifyClicked, 60 * 1000, false); //wait 60 seconds
        } else {
          toast.error(res.message);
        }
      },
      onError: (res) => {
        toast.error("Failed to send verification email", {
          description: res.message,
        });
      },
    });
  };

  return (
    <>
      <div className="pt-15 relative flex max-h-screen w-full flex-col items-center justify-center">
        <video
          ref={videoRef}
          width={300}
          height={300}
          src="/email-error.webm"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          className="h-auto max-w-full rounded-lg shadow-lg"
        >
          Your browser does not support the video tag.
        </video>
        <div className="absolute top-80 flex w-[350px] flex-col items-center justify-center">
          <span className="mb-3 text-2xl text-white">Something went wrong</span>
          <span className="text-secondary-foreground max-w-[450px] text-center">
            Your link is invalid or expired. Please, try again or contact
            support.
          </span>
          <div className="mt-12 flex w-full justify-center gap-3">
            <Button
              className="flex-1"
              disabled={emailVerifyClicked}
              onClick={onClickSendEmail}
            >
              {firstTimeClicked ? "TRY AGAIN" : "RESEND E-MAIL"}
            </Button>
            <Button variant={"outline"} className="border">
              CONTACT SUPPORT
            </Button>
          </div>
          {emailVerifyClicked && (
            <span className="text-primary-foreground w-85 mt-5 text-center text-sm">
              We have sent you a verification email. Please wait{" "}
              <CountdownCounter startCount={WAIT_SECONDS} /> seconds before
              requesting another.
            </span>
          )}
        </div>
      </div>
    </>
  );
}

interface CountdownCounterProps {
  startCount: number;
  intervalMs?: number;
}

const CountdownCounter: React.FC<CountdownCounterProps> = ({
  startCount,
  intervalMs = 1000,
}) => {
  const [count, setCount] = useState(startCount);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (count > 0) {
      const timerId = setInterval(() => {
        setCount((prevCount) => prevCount - 1);
      }, intervalMs);

      return () => clearInterval(timerId);
    } else {
      if (!isFinished) {
        setIsFinished(true);
      }
    }
  }, [count, intervalMs, isFinished]); // Dependencies for useEffect

  return count > 0 ? count : 0;
};
