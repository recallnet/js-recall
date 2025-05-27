"use client";

import {useState} from "react";
import {FaArrowLeft, FaArrowRight} from "react-icons/fa6";
import {LinkPreview} from "../link-previewer";

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

export const NewsHighlightsCarousel: React.FC<NewsHighlightsCarouselProps> = ({links}) => {
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
    <div className="flex flex-col mt-24">
      <h2 className="text-5xl text-gray-500 mb-8 font-semibold">News & Highlights</h2>
      <div className="relative">
        <div className="absolute md:left-[-100] left-[-20] top-1/2 transform -translate-y-1/2 z-10">
          <button
            onClick={handlePrev}
            className="w-15 h-15 hover:bg-gray-100 text-gray-700 flex items-center justify-center border border-gray-300"
          >
            <FaArrowLeft />
          </button>
        </div>
        <div className="grid 2xl:grid-cols-4 md:grid-cols-2 grid-cols-1 xl:gap-10 gap-5 py-10 border-t border-gray-300 justify-center place-items-center">
          {visibleLinks.map((link, i) => (
            <LinkPreview key={i} {...link} />
          ))}
        </div>
        <div className="absolute md:right-[-100] right-[-20] top-1/2 transform -translate-y-1/2 z-10">
          <button
            onClick={handleNext}
            className="w-15 h-15 hover:bg-gray-100 text-gray-700 flex items-center justify-center border border-gray-300"
          >
            <FaArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
};

