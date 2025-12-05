import { listUsers } from "./list";
import { registerUser } from "./register";

export const users = {
  register: registerUser,
  list: listUsers,
} as const;
