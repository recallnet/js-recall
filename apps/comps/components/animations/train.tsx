"use client";

import React, {useEffect, useState} from "react";
import {useInView} from "@/hooks/useInView";
import {cn} from "@recallnet/ui2/lib/utils";

type TrainRevealProps = {
  children: React.ReactNode;
  duration?: number; // total duration of animation (s)
  delay?: number;    // wait before animation starts (s)
  offset?: number;   // px to start from right
  className?: string;
};

export const TrainReveal: React.FC<TrainRevealProps> = ({
  children,
  className,
  duration = 0.6,
  delay = 0,
  offset = 200,
}) => {
  const {ref, inView} = useInView({threshold: 0.3});
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (inView) {
      const timeout = setTimeout(() => setAnimate(true), delay * 1000);
      return () => clearTimeout(timeout);
    }
  }, [inView, delay]);

  return (
    <div
      ref={ref}
      className={cn(className, "transition-all ease-out")}
      style={{
        transform: animate ? "translateX(0)" : `translateX(${offset}px)`,
        opacity: animate ? 1 : 0,
        transition: `transform ${duration}s ease, opacity ${duration}s ease`,
      }}
    >
      {children}
    </div>
  );
};

