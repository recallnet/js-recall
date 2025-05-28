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
    <div className={`overflow-hidden w-full inline-flex flex-nowrap ${className}`}>
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
        className='gap-20 flex nowrap'
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
        }} className='gap-20 flex flex-nowrap'
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

