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
  // Handle ConflictError (409) - typically for duplicate names
  if (error instanceof ConflictError) {
    return {
      step: 1, // Basics step
      field: "name",
      message:
        "An agent with this name already exists. Please choose a different name.",
    };
  }

  // For other errors, return null to use default toast error handling
  return null;
};
