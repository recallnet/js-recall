import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

import { sectionTitleTheme as theme } from "./theme";

const AnimatedWord = ({
  word,
  index,
  isInView,
  animationDelay,
  animationDuration,
}: {
  word: string;
  index: number;
  isInView: boolean;
  animationDelay: number;
  animationDuration: number;
}) => (
  <>
    <motion.span
      className="inline-block"
      key={index}
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 5 : -5 }}
      transition={{
        duration: animationDuration,
        delay: index * animationDelay,
      }}
    >
      {word}
    </motion.span>{" "}
  </>
);

export type SectionTitleProps = {
  title: string;
  isInView?: boolean;
  animation?: {
    delay: number;
    duration: number;
  };
};

export const SectionTitle = ({
  title,
  isInView = true,
  animation = { delay: 0.1, duration: 0.5 },
}: SectionTitleProps) => {
  const words = title.split(" ");

  return (
    <div className="px-5 pb-5 text-center lg:px-0 lg:pb-[30px] lg:text-left">
      <h2 className={twMerge(theme.title.root, theme.title.light)}>
        {words.map((word, index) => (
          <AnimatedWord
            key={index}
            word={word}
            index={index}
            isInView={isInView}
            animationDelay={animation.delay}
            animationDuration={animation.duration}
          />
        ))}
      </h2>
    </div>
  );
};
