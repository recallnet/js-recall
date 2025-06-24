import React from "react";

import { Button } from "@recallnet/ui2/components/button";

interface ErrorMessageProps {
  /** The error object containing the error details */
  error?: Error | null;
  /** The title to display for the error */
  title?: string;
  /** The description to display for the error */
  description?: string;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** The function to call when the user clicks the retry button */
  onRetry?: () => void;
}

/**
 * A reusable component for displaying error messages with consistent styling
 *
 * @param props - The component props
 * @param props.error - The error object containing the error details
 * @param props.title - The title to display for the error
 * @param props.description - The description to display for the error
 * @param props.className - Additional CSS classes to apply to the container
 *
 * @example
 * ```tsx
 * <ErrorMessage
 *   error={error}
 *   title="Failed to load data"
 *   description="Unable to fetch the requested information"
 * />
 * ```
 */
export function ErrorMessage({
  error,
  title = "Error",
  description,
  className = "",
  onRetry,
}: ErrorMessageProps) {
  const errorMessage = error?.message || description || "An error occurred";

  return (
    <div
      className={`rounded border border-red-500 bg-opacity-10 p-6 text-center ${className}`}
    >
      <h2 className="text-xl font-semibold text-red-500">{title}</h2>
      <p className="mt-2">{errorMessage}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
