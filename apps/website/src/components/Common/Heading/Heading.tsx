import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { twMerge } from "tailwind-merge";

import { ANIMATION_DELAY, ANIMATION_DURATION } from "@/constants";

import { Title } from "../Title";
import { headingTheme as theme } from "./theme";

export type HeadingProps = {
  title: string;
  text?: string;
  theme?: "light" | "dark";
  size?: "large" | "medium" | "small" | "xsmall";
  className?: string;
  titleClassName?: string;
  textClassName?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  after?: React.ReactNode;
  isActive?: boolean;
};

export const Heading = ({
  title,
  text,
  theme: colorTheme = "light",
  size = "medium",
  className,
  titleClassName,
  textClassName,
  as = "h2",
  after,
  isActive = undefined,
}: HeadingProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.75 });

  if (!title) {
    return null;
  }

  const isAnimated = isActive ?? isInView;

  const wordsCount = title.split(" ").length;
  const textDelay = wordsCount * ANIMATION_DELAY;
  const afterDelay = textDelay + ANIMATION_DELAY;

  return (
    <div
      className={twMerge(
        "flex w-full flex-col items-center gap-5 text-center",
        className,
      )}
      ref={ref}
    >
      <Title
        title={title}
        animation={{ delay: ANIMATION_DELAY, duration: ANIMATION_DURATION }}
        as={as}
        size={size}
        className={twMerge(theme.title[colorTheme], titleClassName)}
        isInView={isAnimated}
      />

      {text && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: isAnimated ? 1 : 0, y: isAnimated ? 0 : -10 }}
          transition={{ duration: 0.5, delay: textDelay }}
        >
          <p
            className={twMerge(
              "text-[16px] leading-[20px] tracking-[0.38px] lg:text-[19px] lg:leading-[24px]",
              theme.text[colorTheme],
              textClassName,
            )}
          >
            {text}
          </p>
        </motion.div>
      )}

      {after && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: isAnimated ? 1 : 0, y: isAnimated ? 0 : -10 }}
          transition={{ duration: 0.5, delay: afterDelay }}
          className="flex w-full items-center justify-center pt-1"
        >
          {after}
        </motion.div>
      )}
    </div>
  );
};
