import { useMotionValueEvent, useScroll } from "framer-motion";
import { useRef, useState } from "react";

import { SlidesType } from "@/types/components";

import { ShowcaseScreen } from "./ShowcaseScreen";
import { EarnBg } from "./components/earnBg";
import { GrowBg } from "./components/growBg";
import { ProvenBg } from "./components/provenBg";

const SCREENS_COUNT = 5;

export const Showcase = ({ node }: { node: SlidesType }) => {
  const { firstSlide, secondSlide, thirdSlide, fourthSlide } = node;

  const [activeIndex, setActiveIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const index = Math.round(latest * (SCREENS_COUNT - 1));

    setActiveIndex(Math.max(0, Math.min(index, SCREENS_COUNT - 1)));
  });

  return (
    <div ref={scrollRef} className="relative h-[400vh]">
      <div className="h-[50vh]" />

      {firstSlide && (
        <ShowcaseScreen
          currentIndex={activeIndex}
          index={1}
          title={firstSlide.title}
          text={firstSlide.description}
        />
      )}
      {secondSlide && (
        <ShowcaseScreen
          currentIndex={activeIndex}
          index={2}
          title={secondSlide.title}
          text={secondSlide.description}
          bg={<EarnBg isActive={activeIndex === 2} />}
        />
      )}
      {thirdSlide && (
        <ShowcaseScreen
          currentIndex={activeIndex}
          index={3}
          title={thirdSlide.title}
          text={thirdSlide.description}
          bg={<ProvenBg isActive={activeIndex === 3} />}
        />
      )}
      {fourthSlide && (
        <ShowcaseScreen
          currentIndex={activeIndex}
          index={4}
          title={fourthSlide.title}
          text={fourthSlide.description}
          bg={<GrowBg isActive={activeIndex === 4} />}
        />
      )}
    </div>
  );
};
