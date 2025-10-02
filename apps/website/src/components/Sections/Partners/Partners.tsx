import { motion, useInView } from "framer-motion";
import { useMemo, useRef } from "react";

import {
  LogoEliza,
  LogoFilecoin,
  LogoGaia,
  LogoIntuition,
  LogoIoNet,
  LogoIotex,
  LogoLilypad,
  LogoLitProtocol,
  LogoMorpheus,
  LogoOlas,
  LogoProtocolLabs,
  LogoRhinestone,
  LogoSapien,
  LogoSpheron,
  LogoSurf,
  LogoSwarm,
  LogoTerminal3,
} from "./components";

const logos = [
  LogoEliza,
  LogoFilecoin,
  LogoGaia,
  LogoIntuition,
  LogoIoNet,
  LogoIotex,
  LogoLilypad,
  LogoLitProtocol,
  LogoMorpheus,
  LogoOlas,
  LogoProtocolLabs,
  LogoRhinestone,
  LogoSapien,
  LogoSpheron,
  LogoSurf,
  LogoSwarm,
  LogoTerminal3,
];

const Item = ({ Logo }: { Logo: React.ComponentType & { url: string } }) => (
  <div className="flex h-[158px] shrink-0 flex-col items-center justify-center">
    <a
      href={Logo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full items-center justify-center hover:cursor-pointer [&>svg]:h-12 [&>svg]:w-auto [&>svg]:opacity-50 [&>svg]:grayscale [&>svg]:transition-all [&>svg]:duration-300 [&>svg]:hover:opacity-100 [&>svg]:hover:grayscale-0 group-hover:[&>svg]:opacity-100 group-hover:[&>svg]:grayscale-0 [&>svg_*]:transition-all [&>svg_*]:duration-300"
    >
      <Logo />
    </a>
  </div>
);

export const Partners = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const items = useMemo(() => [...logos, ...logos, ...logos], []);

  const duration = logos.length * 1.875;

  return (
    <section
      className="flex w-full flex-col items-center justify-center pb-10 pt-20"
      ref={ref}
    >
      <div className="w-full">
        <div className="mx-auto max-w-[1136px] text-center">
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : -10 }}
            transition={{ duration: 0.5 }}
            className="text-gray mb-2 text-[16px] leading-[20px] tracking-[0.38px] lg:text-[19px] lg:leading-[24px]"
          >
            Powering the future of AI
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 10 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative overflow-hidden">
            <div className="w-full max-lg:px-5">
              <motion.div
                ref={containerRef}
                className="flex w-max flex-row gap-20 px-10"
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
                {items.map((Logo, index) => (
                  <Item key={index} Logo={Logo} />
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
