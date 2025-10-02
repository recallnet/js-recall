import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

import { Heading } from "@/components/Common/Heading";
import { ANIMATION_DELAY } from "@/constants";
import { AcceleratingType } from "@/types/components";

import { AcceleratingCarousel } from "./AcceleratingCarousel";

export const Accelerating = ({ node }: { node: AcceleratingType }) => {
  const { heading, text, cta } = node;

  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const wordsCount = heading.split(" ").length;
  const contentDelay = wordsCount * ANIMATION_DELAY + ANIMATION_DELAY;

  return (
    <section
      ref={ref}
      className="flex flex-col items-center bg-[#F4F4F4] pt-8 lg:py-[100px]"
    >
      <div className="max-w-[280px] text-center md:max-w-[364px] lg:max-w-[562px]">
        <Heading title={heading} />
      </div>

      <div className="mb-7 mt-8 w-full overflow-hidden lg:mb-[54px] lg:mt-[60px]">
        <AcceleratingCarousel
          isInView={isInView}
          animationDelay={contentDelay}
        />
      </div>

      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
        transition={{ duration: 1, delay: contentDelay + ANIMATION_DELAY }}
        className="flex w-full max-w-[510px] flex-col gap-[25px] px-12 lg:px-0"
      >
        <p className="text-mutedLight text-[16px] leading-[20px] tracking-[0.38px] lg:text-[19px] lg:leading-[24px]">
          {text}
        </p>

        {cta && cta.href && (
          <Link
            href="#"
            className="font-secondary group flex flex-row items-center gap-1.5 text-[12px] font-semibold uppercase leading-[1] tracking-[1.56px] text-[#1D1F2B]"
          >
            {cta.title}
            <svg
              width="11"
              height="16"
              viewBox="0 0 11 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="-translate-y-[1px] transition-all duration-300 group-hover:translate-x-0.5"
            >
              <path
                d="M4.727 13V11.973L7.652 9.152H0.072998V7.748H7.652L4.727 4.927V3.9H5.858L9.953 8.008V8.905L5.858 13H4.727Z"
                fill="#1D1F2B"
              />
            </svg>
          </Link>
        )}
      </motion.div>
    </section>
  );
};
