import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

import { ANIMATION_DELAY } from "@/constants";
import { Competition } from "@/types/components";

import { RewardsCard } from "./RewardsCard";
import { RewardsCardEmpty } from "./RewardsCardEmpty";

const Tab = forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
  }
>(({ children, active, onClick }, ref) => (
  <button
    className={twMerge(
      "font-secondary w-1/2 min-w-[168px] text-center text-sm font-semibold uppercase max-lg:h-10 max-lg:text-[11px] lg:py-4",
      active ? "text-[#1D1F2B]" : "text-mutedLight",
    )}
    type="button"
    onClick={onClick}
    ref={ref}
  >
    {children}
  </button>
));

Tab.displayName = "Tab";

export const RewardsSwitcher = ({
  animationDelay,
  isInView,
  activeCompetitions,
  pastCompetitions,
}: {
  animationDelay: number;
  isInView: boolean;
  activeCompetitions: Competition[];
  pastCompetitions: Competition[];
}) => {
  const [tab, setTab] = useState<"active" | "past">("active");
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const pastTabRef = useRef<HTMLButtonElement>(null);
  const [highlightStyles, setHighlightStyles] = useState({
    width: 0,
    transform: "translateX(0px)",
  });

  const cardDelay = animationDelay + ANIMATION_DELAY;

  useEffect(() => {
    const currentTabRef = tab === "active" ? activeTabRef : pastTabRef;

    if (currentTabRef.current) {
      const width = currentTabRef.current.offsetWidth;
      const left = currentTabRef.current.offsetLeft;

      setHighlightStyles({
        width,
        transform: `translateX(${left}px)`,
      });
    }
  }, [tab]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : -10 }}
        transition={{ duration: 0.5, delay: animationDelay }}
        className="w-full max-w-[410px]"
      >
        <div className="relative flex w-full items-center border-t border-[#C3CAD2]">
          <Tab
            active={tab === "active"}
            onClick={() => setTab("active")}
            ref={activeTabRef}
          >
            Active competitions
          </Tab>
          <Tab
            active={tab === "past"}
            onClick={() => setTab("past")}
            ref={pastTabRef}
          >
            Past competitions
          </Tab>

          <div
            className="transition-width absolute -top-[1px] left-0 h-[2px] bg-black transition-transform duration-300"
            style={{
              width: `${highlightStyles.width}px`,
              transform: highlightStyles.transform,
            }}
          />
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : -10 }}
        transition={{ duration: 0.5, delay: cardDelay }}
        className="w-full"
      >
        <div className="relative min-h-[227px] w-full overflow-hidden">
          <AnimatePresence propagate>
            {tab === "active" && (
              <div className="flex w-full flex-col gap-2 lg:gap-[30px]">
                {activeCompetitions.map((competition) => (
                  <RewardsCard
                    key={competition._id}
                    title={competition.title}
                    description={competition.text}
                    link={competition.ctaUrl}
                    linkText={competition.cta}
                  />
                ))}
              </div>
            )}
            {tab === "past" && (
              <div className="flex w-full flex-col gap-2 lg:gap-[30px]">
                {pastCompetitions?.map((competition) => (
                  <RewardsCard
                    key={competition._id}
                    title={competition.title}
                    description={competition.text}
                    link={competition.ctaUrl}
                    linkText={competition.cta}
                  />
                ))}

                {!pastCompetitions?.length && <RewardsCardEmpty />}
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
