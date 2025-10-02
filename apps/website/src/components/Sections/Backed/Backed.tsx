import { motion, useInView } from "framer-motion";
import { useRef } from "react";

import { SectionTitle } from "@/components/Common/SectionTitle";
import { BackedSectionType } from "@/types/components";

import { BackedLogos } from "./BackedLogos";
import { BackedSocial } from "./BackedSocial";

export const Backed = ({ node }: { node: BackedSectionType }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  const { backed, swarm } = node;

  return (
    <section
      className="flex w-full flex-col items-center justify-center bg-[#F4F4F4] pb-20 pt-[140px] lg:pb-[120px]"
      ref={ref}
    >
      <div className="flex w-full flex-col items-center gap-[76px]">
        <div className="w-full">
          <div className="mx-auto max-w-[1140px]">
            <SectionTitle title={backed.heading} isInView={isInView} />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 10 }}
            transition={{ duration: 0.5 }}
          >
            <BackedLogos logos={backed.logos} />
          </motion.div>
        </div>

        <div className="w-full max-w-[1140px]">
          <SectionTitle title={swarm.heading} isInView={isInView} />
          <motion.div
            initial={{ opacity: 0, y: 10, x: 10 }}
            animate={{
              opacity: isInView ? 1 : 0,
              y: isInView ? 0 : 10,
              x: isInView ? 0 : 10,
            }}
            transition={{ duration: 0.5 }}
          >
            <BackedSocial social={swarm.social} />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
