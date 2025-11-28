import { agents } from "./agents";
import { arenas } from "./arenas";
import { competitions } from "./competitions";
import { partners } from "./partners";
import { users } from "./users";

export const router = {
  arenas,
  partners,
  competitions,
  agents,
  users,
} as const;
