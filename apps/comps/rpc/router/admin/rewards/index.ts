import { allocateRewards } from "./allocate";

export const rewards = {
  allocate: allocateRewards,
} as const;
