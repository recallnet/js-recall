"use client";

import React from "react";

type InfiniteCarouselProps = {
  items: React.ReactNode[];
  speed?: number; // seconds for full loop
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
};

export const InfiniteCarousel: React.FC<InfiniteCarouselProps> = ({
  items,
  speed = 20,
  reverse = false,
  className = "",
  itemClassName = "",
}) => {
  const direction = reverse ? "reverse" : "normal";

  return (
    <div
      className={`inline-flex w-[1450px] flex-nowrap overflow-hidden ${className}`}
    >
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-100%); }
          }
        `}
      </style>
      <div
        style={{
          animation: `marquee ${speed}s linear infinite`,
          animationDirection: direction,
        }}
        className="nowrap flex gap-20"
      >
        {[...items].map((item, i) => (
          <div key={i} className={itemClassName}>
            {item}
          </div>
        ))}
      </div>
      <div
        style={{
          animation: `marquee ${speed}s linear infinite`,
          animationDirection: direction,
        }}
        className="flex flex-nowrap gap-20"
      >
        {[...items].map((item, i) => (
          <div key={i} className={itemClassName}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
