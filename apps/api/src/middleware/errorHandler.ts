import { NextFunction, Request, Response } from "express";

import { ApiError } from "@recallnet/services/types";

import { middlewareLogger } from "@/lib/logger.js";

/**
 * Global error handler middleware
 */
const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  middlewareLogger.error(`Error: ${err.message}`);
  middlewareLogger.error(err.stack);

  // Handle specific API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Handle inactive agent errors
  if (err.message && err.message.includes("inactive")) {
    // TODO: if an error has the word "inactive" in it's message, it does NOT mean
    //  it's a 403. Instead of catching individual cases here, the check for
    //  inactive agents should throw a 403, and this should be removed.
    return res.status(403).json({
      success: false,
      error: err.message,
      inactive: true,
    });
  }

  // Handle other errors
  return res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
};

export default errorHandler;
