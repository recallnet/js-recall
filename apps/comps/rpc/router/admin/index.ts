import { agents } from "./agents";
import { arenas } from "./arenas";
import { bonusBoost } from "./bonus-boost";
import { competitions } from "./competitions";
import { partners } from "./partners";
import { reports } from "./reports";
import { rewards } from "./rewards";
import { globalSearch } from "./search";
import { setupAdmin } from "./setup";
import { users } from "./users";

export const router = {
  setup: setupAdmin,
  arenas,
  partners,
  competitions,
  agents,
  users,
  reports,
  rewards,
  search: globalSearch,
  bonusBoost,
} as const;
