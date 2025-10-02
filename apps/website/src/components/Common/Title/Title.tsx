import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

import { titleTheme as theme } from "./theme";

const AnimatedWord = ({
  word,
  index,
  isInView,
  startIndex,
  animationDelay,
  animationDuration,
}: {
  word: string;
  index: number;
  isInView: boolean;
  startIndex: number;
  animationDelay: number;
  animationDuration: number;
}) => (
  <>
    <motion.span
      className="inline-block"
      key={startIndex + index}
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

export const Title = ({
  as = "h2",
  size = "medium",
  className,
  title,
  isInView,
  animation: { delay, duration },
}: {
  title: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  size?: "large" | "medium" | "small" | "xsmall";
  className?: string;
  isInView: boolean;
  animation: {
    delay: number;
    duration: number;
  };
}) => {
  const Tag = as;
  const words = title?.toString().split(" ");

  return (
    <Tag className={twMerge(theme.root, theme[size], className)}>
      {words?.map((word, index) => (
        <AnimatedWord
          key={index}
          word={word}
          index={index}
          isInView={isInView}
          startIndex={0}
          animationDelay={delay}
          animationDuration={duration}
        />
      ))}
    </Tag>
  );
};
