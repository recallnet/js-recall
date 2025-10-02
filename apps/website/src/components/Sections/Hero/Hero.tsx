import Link from "next/link";
import { useRef } from "react";

import { Heading } from "@/components/Common/Heading";
import { Hero as HeroType } from "@/types/components";

export const Hero = ({ node }: { node: HeroType }) => {
  const ref = useRef<HTMLDivElement>(null);

  const { heading, subheading, primaryCTA, secondaryCTA } = node;

  return (
    <section
      ref={ref}
      className="relative flex h-[654px] w-full flex-col items-center justify-end overflow-hidden pb-[48px] lg:h-[95vh] lg:pb-[90px]"
    >
      <div className="absolute left-0 top-[56px] -z-10 h-full w-full lg:-bottom-1 lg:left-3 lg:top-auto">
        <video
          src="/hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute left-1/2 h-auto w-[872px] max-w-none -translate-x-1/2 lg:w-[1420px]"
        />
      </div>

      <div className="flex w-full max-w-[328px] flex-col items-center justify-center gap-6 lg:max-w-[575px]">
        <Heading
          theme="dark"
          as="h1"
          title={heading}
          text={subheading}
          titleClassName="max-lg:max-w-[260px]"
          textClassName="max-w-[225px] lg:max-w-[400px]"
          after={
            <div className="flex w-full max-w-[480px] flex-row border border-[#212C3A]">
              {primaryCTA && (
                <Link
                  href={primaryCTA.link}
                  target="_blank"
                  className="font-secondary flex h-[54px] w-1/2 items-center justify-center bg-[#E9EDF1] text-center text-[12px] font-semibold uppercase tracking-[1.56px] text-[#212C3A] transition-all duration-300 hover:bg-[#0064C7] hover:text-[#CED2D4]"
                >
                  {primaryCTA.label}
                </Link>
              )}
              {secondaryCTA && (
                <Link
                  href={secondaryCTA.link}
                  target="_blank"
                  className="font-secondary flex h-[54px] w-1/2 items-center justify-center text-center text-[12px] font-semibold uppercase tracking-[1.56px] text-[#D2D9E1] transition-all duration-300 hover:bg-[#272B3B] hover:text-[#D2D9E1]"
                >
                  {secondaryCTA.label}
                </Link>
              )}
            </div>
          }
        />
      </div>
    </section>
  );
};
