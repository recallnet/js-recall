import { addBonusBoost } from "./add";
import { revokeBonusBoost } from "./revoke";

export const bonusBoost = {
  add: addBonusBoost,
  revoke: revokeBonusBoost,
} as const;
