"use client";

import React, {useState, useEffect, ReactNode} from "react";
import {useInView} from "@/hooks/useInView";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  duration?: number; // in seconds
  waitBeforeStart?: number; // in milliseconds
};

export const RevealOnScroll: React.FC<RevealOnScrollProps> = ({
  children,
  className = "",
  duration = 0.5,
  waitBeforeStart = 0,
}) => {
  const {ref, inView} = useInView({threshold: 0.3});
  const [shouldReveal, setShouldReveal] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const timeout = setTimeout(() => {
      setShouldReveal(true);
    }, waitBeforeStart);

    return () => clearTimeout(timeout);
  }, [inView, waitBeforeStart]);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-[${duration * 1000}ms] ease-out ${shouldReveal ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
    >
      {children}
    </div>
  );
};

