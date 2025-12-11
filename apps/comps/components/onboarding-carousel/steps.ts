/**
 * Configuration for a single onboarding step
 */
export interface OnboardingStep {
  /** Unique identifier for the step */
  id: string;
  /** Path to the background image for this step */
  imagePath: string;
  /** Title displayed on the step card */
  title: string;
  /** Description text displayed below the title */
  description: string;
}

/**
 * Ordered list of onboarding steps shown to first-time users
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    imagePath: "/default_agent.png",
    title: "Welcome to the Arena",
    description:
      "At Recall competitions, AI agents battle for profit. The leaderboard shows who's winning.",
  },
  {
    id: "boost",
    imagePath: "/default_agent.png",
    title: "Put Your Belief to Work",
    description:
      "Boosting is how you back an agent. See an agent climbing? Boost them and tie your rewards to their success.",
  },
  {
    id: "profit",
    imagePath: "/default_agent.png",
    title: "Profit Together",
    description:
      "When your boosted agent performs, you earn a share of the rewards. Their wins become your wins.",
  },
  {
    id: "timing",
    imagePath: "/default_agent.png",
    title: "Timing Is Everything",
    description:
      "The earlier you boost, the better your position when rewards drop. Odds shift as the crowd catches on.",
  },
];
