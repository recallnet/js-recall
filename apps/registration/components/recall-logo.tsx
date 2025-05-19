"use client";

import React from "react";

/**
 * RecallLogo component
 *
 * The official SVG logo for Recall
 *
 * @param props - Standard React props including className
 * @returns The Recall logo component
 */
export default function RecallLogo({
  className = "",
  color = "#D2D9E1",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      data-animated="No"
      data-color="White"
      className={`${className}`}
      aria-label="Recall Logo"
    >
      <svg
        viewBox="0 0 55 55"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[55px] w-[55px]"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M13.4045 12.3281H33.3496L33.4119 12.3439C36.9104 13.2296 39.4542 16.7391 39.4542 20.4579C39.4542 24.0859 37.0294 27.6593 33.6394 28.6252L33.5702 28.6449H13.4045V25.7406L16.1682 22.977H31.4389C31.9479 22.977 32.4573 22.6862 32.8588 22.1861C33.2597 21.6868 33.5 21.0398 33.5 20.4579C33.5 19.879 33.2619 19.2646 32.867 18.7968C32.4726 18.3298 31.9624 18.0533 31.4389 18.0533H16.1682L13.4045 15.2896V12.3281ZM25.7137 39.588L15.9729 29.8472H13.4045V36.4884L19.1297 42.2136H25.7137V39.588ZM39.1106 42.2136V39.588L29.3699 29.8472H26.8015V36.509L32.5061 42.2136H39.1106Z"
          fill={color}
        />
      </svg>
    </div>
  );
}
