import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class with HTTP status code
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
const errorHandler = (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);

  // Handle specific API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Handle inactive team errors
  if (err.message && err.message.includes('inactive')) {
    return res.status(403).json({
      success: false,
      error: err.message,
      inactive: true,
    });
  }

  // Handle other errors
  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
  });
};

export default errorHandler;
