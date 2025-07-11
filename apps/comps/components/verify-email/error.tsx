"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import React, { useEffect, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { toast } from "@recallnet/ui2/components/toast";
import { cn } from "@recallnet/ui2/lib/utils";

import { useVerifyEmail } from "@/hooks/useVerifyEmail";

const WAIT_SECONDS = 60;

export default function ErrorVerifyEmail() {
  const [emailVerifyClicked, setEmailVerifyClicked] = useState(false);
  const [firstTimeClicked, setFirstTimeClicked] = useState(false);
  const { mutate: verifyEmail } = useVerifyEmail();

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
      <div className="relative flex max-h-screen w-full flex-col items-center">
        <div className="absolute flex w-[350px] flex-col items-center justify-center">
          <DotLottieReact
            src="https://lottie.host/efac4a14-b34c-43a1-8dc6-82de4e0cc967/2JzfYDIhQN.lottie"
            autoplay
            className="w-200 h-100"
          />
          <span className="mb-3 text-2xl text-white">Something went wrong</span>
          <span className="text-secondary-foreground max-w-[450px] text-center">
            Your link is invalid or expired. Please, try again or contact
            support.
          </span>
          <div className="mt-12 flex w-full justify-center gap-3">
            <Button
              className={cn(
                "flex-1 disabled:pointer-events-auto disabled:cursor-not-allowed disabled:bg-blue-600",
              )}
              disabled={emailVerifyClicked}
              onClick={onClickSendEmail}
            >
              {firstTimeClicked ? "TRY AGAIN" : "RESEND E-MAIL"}
            </Button>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://discord.recall.network"
            >
              <Button variant={"outline"} className="border">
                CONTACT SUPPORT
              </Button>
            </a>
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
