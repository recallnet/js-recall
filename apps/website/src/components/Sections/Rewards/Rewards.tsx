import { useInView } from "framer-motion";
import { useRef } from "react";

import { Heading } from "@/components/Common/Heading";
import { ANIMATION_DELAY } from "@/constants";
import { competitionsData } from "@/lib/load-json";

import { RewardsSubscribe } from "./RewardsSubscribe";
import { RewardsSwitcher } from "./RewardsSwitcher";

export const Rewards = () => {
  const { heading, subheading, activeCompetitions, pastCompetitions } =
    competitionsData;

  const ref = useRef<HTMLDivElement>(null);
  const wordsCount = heading.split(" ").length;
  const contentDelay = wordsCount * ANIMATION_DELAY + ANIMATION_DELAY;
  const subscribeDelay = contentDelay + ANIMATION_DELAY;

  const isInView = useInView(ref, { once: true });

  return (
    <section className="flex flex-col items-center bg-[#F4F4F4] px-5 pb-8 pt-[110px] lg:pb-20">
      <div className="mb-[30px] max-w-[988px]" ref={ref}>
        <div className="text-center">
          <Heading
            title={heading}
            text={subheading}
            textClassName="max-w-[396px]"
          />
        </div>
      </div>

      <div className="flex w-full max-w-[600px] flex-col gap-4 lg:max-w-[812px] lg:gap-10">
        <RewardsSwitcher
          animationDelay={contentDelay}
          isInView={isInView}
          activeCompetitions={activeCompetitions}
          pastCompetitions={pastCompetitions}
        />
        <RewardsSubscribe animationDelay={subscribeDelay} isInView={isInView} />
      </div>
    </section>
  );
};
