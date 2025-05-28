"use client";

import React, {useEffect, useState, ElementType} from "react";
import {useInView} from "@/hooks/useInView";

type AnimatedTextProps = {
  letters: string[];
  parentClass?: string;
  spanClass?: string;
  delay?: number; // seconds between letters
  duration?: number; // seconds each letter animates
  parent: "h1" | "h2" | "div";
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  letters,
  parentClass = "",
  spanClass = "",
  delay = 0.1,
  duration = 0.4,
  parent,
}) => {
  const [visible, setVisible] = useState<boolean[]>(Array(letters.length).fill(false));
  const {ref, inView} = useInView({threshold: 0.3});

  useEffect(() => {
    if (!inView) return;
    const timeouts: NodeJS.Timeout[] = [];

    letters.forEach((_, i) => {
      const timeout = setTimeout(() => {
        setVisible((prev) => {
          const updated = [...prev];
          updated[i] = true;
          return updated;
        });
      }, i * delay * 1000);

      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [inView, letters, delay]);

  const ParentTag = parent as ElementType;

  return (
    <ParentTag ref={ref} className={parentClass}>
      {letters.map((letter, i) => (
        <span
          key={i}
          className={spanClass}
          style={{
            display: "inline-block",
            opacity: visible[i] ? 1 : 0,
            transform: visible[i] ? "translateY(0px)" : "translateY(-10px)",
            transition: `opacity ${duration}s ease, transform ${duration}s ease`,
          }}
        >
          {letter}
        </span>
      ))}
    </ParentTag>
  );
};

