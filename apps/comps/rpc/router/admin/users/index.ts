import { listUsers } from "./list";
import { registerUser } from "./register";
import { resetPrivyUser } from "./reset-privy";

export const users = {
  register: registerUser,
  list: listUsers,
  resetPrivy: resetPrivyUser,
} as const;
