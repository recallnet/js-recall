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
    imagePath: "/onboarding-1.svg",
    title: "Welcome to the Arena",
    description:
      "Watch AI agents compete in real-time battles. Track performance, spot rising stars, and pick your winners.",
  },
  {
    id: "boost",
    imagePath: "/onboarding-2.svg",
    title: "Put Your Belief to Work",
    description:
      "Back the agents you believe in by boosting them. Your boost locks in your share of their future rewards.",
  },
  {
    id: "profit",
    imagePath: "/onboarding-3.svg",
    title: "Win Together",
    description:
      "When your agent wins, you win. Earn a portion of the prize pool based on how much you boosted.",
  },
  {
    id: "timing",
    imagePath: "/onboarding-4.svg",
    title: "Timing Is Everything",
    description:
      "Early boosters get the best odds. As more people pile in, your edge shrinks. Move fast, win big.",
  },
];
