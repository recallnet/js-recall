"use client";

import React, { useEffect, useState } from "react";

const path = [
  "",
  "translateX(100%)",
  //because of a small space diff, translate y is 99%
  "translateY(99%) translateX(100%)",
  "translateY(99%)",
];
type Section = "top-left" | "top-right" | "bottom-right" | "bottom-left";
const sections: Section[] = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
];

const transitionDuration = 500;

const SquarePathAnimation: React.FC = () => {
  const [pathIndex, setPathIndex] = useState(0);
  const [backgroundState, setBackgroundState] = useState({
    "top-left": true,
    "top-right": true,
    "bottom-right": true,
    "bottom-left": true,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setPathIndex((prev) => (prev + 1) % path.length);

      sections.map((cur, i) => {
        if (pathIndex == i)
          setBackgroundState((prev) => ({ ...prev, [cur]: !prev[cur] }));
      });
    }, transitionDuration); // 2x duration for forward/backward + a little pause

    return () => clearInterval(interval);
  });

  return (
    <div className="full relative h-[166px] w-[166px]">
      <div
        className="absolute z-10 h-[83px] w-[83px] bg-white transition-transform ease-in-out"
        style={{
          transform: path[pathIndex],
          transitionDuration: `${transitionDuration}ms`,
        }}
      ></div>
      {sections.map((cur, i) => (
        <div
          key={i}
          className="absolute left-0 top-0 z-0 h-[83px] w-[83px] bg-gray-500 transition-transform ease-in-out"
          style={{
            transform: backgroundState[cur] ? path[i] : path[pathIndex],
            transitionDuration: `${transitionDuration}ms`,
          }}
        ></div>
      ))}
    </div>
  );
};

export default SquarePathAnimation;
