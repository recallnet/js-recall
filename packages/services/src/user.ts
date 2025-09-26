import { ResultAsync, errAsync, ok } from "neverthrow";
import { Logger } from "pino";

import { UserRepository } from "@recallnet/db/repositories/user";
import { SelectUser } from "@recallnet/db/schema/core/types";

import { errorToMessage } from "./utils/error-to-message.js";

/**
 * Error types for user operations
 */
export type GetUserError =
  | { type: "UserNotFound" }
  | { type: "RepositoryError"; message: string };

/**
 * User Service
 * Manages user operations including validation and business logic
 */
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private logger: Logger,
  ) {}

  /**
   * Get user by ID
   * @param userId The user ID to retrieve
   * @returns Result containing the user or an error
   */
  getUser(userId: string): ResultAsync<SelectUser, GetUserError> {
    return ResultAsync.fromPromise(
      this.userRepository.findById(userId),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    ).andThen((user) => {
      if (!user) {
        return errAsync({ type: "UserNotFound" } as const);
      }
      return ok(user);
    });
  }

  /**
   * Get user by Privy ID
   * @param privyId The Privy ID to retrieve
   * @returns Result containing the user or an error
   */
  getUserByPrivyId(privyId: string): ResultAsync<SelectUser, GetUserError> {
    return ResultAsync.fromPromise(
      this.userRepository.findByPrivyId(privyId),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    ).andThen((user) => {
      if (!user) {
        return errAsync({ type: "UserNotFound" } as const);
      }
      return ok(user);
    });
  }
}
