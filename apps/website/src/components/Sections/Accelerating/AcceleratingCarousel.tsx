import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { AcceleratinImages } from "./AcceleratinImages";

const Item = ({
  title,
  children,
  isInView,
  delay,
  index,
}: {
  title?: string;
  children: React.ReactNode;
  isInView: boolean;
  delay: number;
  index: number;
}) => {
  const shouldHideOnMobile = index < 3 || index > 6;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isInView ? 1 : 0 }}
      transition={{ duration: 0.5, delay }}
      className={`${shouldHideOnMobile ? "hidden lg:block" : ""}`}
    >
      <div className="[&>svg]:h-[auto] [&>svg]:w-[176px] [&>svg]:lg:h-[340px] [&>svg]:lg:w-[277px]">
        {children}
      </div>
      {title && <div>{title}</div>}
    </motion.div>
  );
};

export const AcceleratingCarousel = ({
  isInView,
  animationDelay,
}: {
  isInView: boolean;
  animationDelay: number;
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 1024px)").matches);
  }, []);

  const images = [
    ...AcceleratinImages,
    AcceleratinImages[0],
    AcceleratinImages[1],
    AcceleratinImages[2],
  ];

  const duration = isMobile ? 1 : 3;
  const startIndex = isMobile ? 3 : 0;

  return (
    <motion.div
      initial={{ translateX: "75%" }}
      animate={{ translateX: isInView ? "0%" : "75%" }}
      transition={{ duration, delay: animationDelay, ease: "easeInOut" }}
    >
      <div className="scrolling-touch flex flex-row gap-[10px] max-lg:overflow-x-scroll max-lg:px-12 lg:justify-center lg:gap-10">
        {images.map((image, index) => (
          <Item
            key={index}
            index={index}
            isInView={isInView}
            delay={(index - startIndex) * 0.25 + animationDelay}
          >
            {image}
          </Item>
        ))}
      </div>
    </motion.div>
  );
};
