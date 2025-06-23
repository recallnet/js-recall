import { FormData } from "./index";

export interface HttpErrorMapping {
  step: number;
  field: keyof FormData;
  message: string;
}

/**
 * Maps HTTP errors to form field errors
 * @param error - The error to map
 * @returns Error mapping or null if unmappable
 */
export function mapHttpError(error: Error): HttpErrorMapping | null {
  const message = error.message.toLowerCase();

  // Agent name conflicts
  if (message.includes("agent") && message.includes("name")) {
    return {
      step: 1,
      field: "name",
      message:
        "An agent with this name already exists. Please choose a different name.",
    };
  }

  // Email conflicts
  if (message.includes("email")) {
    return {
      step: 2,
      field: "email",
      message: "This email is already associated with another agent.",
    };
  }

  // Repository URL conflicts
  if (message.includes("repository")) {
    return {
      step: 1,
      field: "repositoryUrl",
      message: "This repository URL is already in use.",
    };
  }

  // Generic conflict error
  if (message.includes("conflict") || message.includes("already exists")) {
    return {
      step: 1,
      field: "name",
      message:
        "This agent name is already taken. Please choose a different name.",
    };
  }

  return null;
}
