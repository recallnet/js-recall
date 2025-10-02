import { motion, useInView } from "framer-motion";
import { useRef } from "react";

import { Heading } from "@/components/Common/Heading";
import { ANIMATION_DELAY } from "@/constants";
import { BuildType } from "@/types/components";

import { BuildBg } from "./BuildBg";
import { BuildIcon } from "./BuildIcon";

export const Build = ({ node }: { node: BuildType }) => {
  const { heading, subheading, icons } = node;

  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const wordsCount = heading.split(" ").length;
  const contentDelay = wordsCount * ANIMATION_DELAY + ANIMATION_DELAY;

  return (
    <section className="relative z-20 -mb-[75vh] flex flex-col items-center gap-6 bg-black pt-[50px] md:gap-[45px] md:pt-[70px] lg:gap-[60px] lg:py-[100px]">
      <BuildBg />
      <div className="relative z-10 max-w-[280px] text-center md:max-w-[364px] lg:max-w-[480px]">
        <Heading
          title={heading}
          text={subheading}
          theme="dark"
          textClassName="md:max-w-[280px] lg:max-w-[456px]"
        />
      </div>

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : -10 }}
        transition={{ duration: 0.5, delay: contentDelay }}
        className="grid w-full max-w-[355px] grid-cols-1 gap-[10px] px-5 md:max-w-[640px] md:grid-cols-2 md:gap-[20px] lg:max-w-[814px] lg:gap-10 lg:px-0"
      >
        {icons.map((item) => (
          <div
            key={item.title}
            className="clip-path-polygon group h-[161px] w-full bg-[#212C3A] p-[1px]"
          >
            <div className="clip-path-polygon flex h-full w-full flex-row bg-black">
              <div className="w-1/2 pl-[22px] pt-5">
                <span className="font-secondary block max-w-[140px] text-[13px] font-semibold uppercase leading-[1.25] tracking-[1.04px] text-[#E9EDF1]">
                  {item.title}
                </span>
              </div>
              <div className="my-[15px] w-[1px] shrink-0 bg-[#212C3A]" />
              <div className="flex w-1/2 items-center justify-center">
                <BuildIcon icon={item.icon} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  );
};
