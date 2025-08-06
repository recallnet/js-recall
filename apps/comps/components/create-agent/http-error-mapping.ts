import { ConflictError } from "@/lib/api-client";

import { FormData } from "./index";

/**
 * Maps http errors to their corresponding form step and field
 */
export interface HttpErrorMapping {
  step: number;
  field: keyof FormData;
  message: string;
}

export const mapHttpError = (error: Error): HttpErrorMapping | null => {
  // Handle ConflictError (409) - typically for duplicate names or handles
  if (error instanceof ConflictError) {
    // Basics steps
    if (error.message.includes("name")) {
      return {
        step: 1,
        field: "name",
        message: `${error.message}. Please choose a different name.`,
      };
    } else if (error.message.includes("handle")) {
      return {
        step: 1,
        field: "handle",
        message: `${error.message}. Please choose a different handle.`,
      };
    }
    return null;
  }

  // For other errors, return null to use default toast error handling
  return null;
};
