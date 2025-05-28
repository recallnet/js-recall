"use client";

import { useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";

import { LinkPreview } from "../link-previewer";

type LinkPreviewData = {
  url: string;
  title: string;
  description?: string;
  image?: string;
  siteIcon?: string;
  siteHandle?: string;
  date?: string;
};

type NewsHighlightsCarouselProps = {
  links: LinkPreviewData[];
};

export const NewsHighlightsCarousel: React.FC<NewsHighlightsCarouselProps> = ({
  links,
}) => {
  const [start, setStart] = useState(0);
  const step = 4;

  const handlePrev = () => {
    setStart((prev) => Math.max(prev - step, 0));
  };

  const handleNext = () => {
    if (start + step < links.length) {
      setStart((prev) => prev + step);
    }
  };

  const visibleLinks = links.slice(start, start + step);

  return (
    <div className="mt-24 flex flex-col">
      <h2 className="mb-8 text-5xl font-semibold text-gray-500">
        News & Highlights
      </h2>
      <div className="relative">
        <div className="absolute left-[-20] top-1/2 z-10 -translate-y-1/2 transform md:left-[-100]">
          <button
            onClick={handlePrev}
            className="w-15 h-15 flex items-center justify-center border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            <FaArrowLeft />
          </button>
        </div>
        <div className="grid grid-cols-1 place-items-center justify-center gap-5 border-t border-gray-300 py-10 md:grid-cols-2 xl:gap-10 2xl:grid-cols-4">
          {visibleLinks.map((link, i) => (
            <LinkPreview key={i} {...link} />
          ))}
        </div>
        <div className="absolute right-[-20] top-1/2 z-10 -translate-y-1/2 transform md:right-[-100]">
          <button
            onClick={handleNext}
            className="w-15 h-15 flex items-center justify-center border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};
