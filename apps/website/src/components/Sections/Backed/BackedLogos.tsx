import { motion } from "framer-motion";
import Image from "next/image";
import { useMemo, useRef } from "react";

import { BackedType } from "@/types/components";

const Item = ({
  src,
  width,
  height,
}: {
  src: string;
  width: number;
  height: number;
}) => (
  <div className="flex h-[158px] shrink-0 grow flex-col items-center justify-center">
    <Image src={src} alt="logo" width={width} height={height} />
  </div>
);

export const BackedLogos = ({ logos }: { logos: BackedType[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => [...logos, ...logos, ...logos], [logos]);

  const duration = logos.length * 1.875;

  return (
    <div className="flex flex-col gap-5">
      <div className="border-foreground/10 mx-5 max-w-[1140px] grow border-t lg:mx-auto lg:w-full" />
      <div className="relative overflow-hidden">
        <div className="w-full max-lg:px-5">
          <motion.div
            ref={containerRef}
            className="flex w-max flex-row gap-[80px] px-[40px]"
            animate={{
              x: ["0", "-33.333333%"],
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: duration,
                ease: "linear",
              },
            }}
          >
            {items.map((logo, index) => (
              <Item
                key={`${logo._id}-${index}`}
                src={logo.image.url}
                width={logo.image.width}
                height={logo.image.height}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
