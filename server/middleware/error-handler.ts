/**
 * Global error handling middleware for Express
 * Catches all errors and formats them consistently
 */

import { Request, Response, NextFunction } from 'express';
import { isAppError, isOperationalError } from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config';

/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle AppError instances
  if (isAppError(err)) {
    logger.error('Application error', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      organizationId: (req as any).user?.organizationId,
      details: err.details,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
        ...(config.isDevelopment && { stack: err.stack }),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    logger.warn('Validation error', {
      path: req.path,
      method: req.method,
      errors: (err as any).errors,
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          fields: (err as any).errors,
        },
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle MongoDB/Database errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    logger.error('Database error', {
      error: err.message,
      name: err.name,
      path: req.path,
      method: req.method,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: config.isProduction
          ? 'A database error occurred'
          : err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    logger.warn('Authentication error', {
      error: err.message,
      path: req.path,
      method: req.method,
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Invalid or expired authentication token',
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Handle unexpected errors (programming errors)
  logger.error('Unexpected error', {
    error: err.message,
    stack: err.stack,
    name: err.name,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    userId: (req as any).user?.id,
  });

  // In production, don't expose internal error details
  const message = config.isProduction
    ? 'An unexpected error occurred'
    : err.message;

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(config.isDevelopment && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * 404 Not Found handler
 * Should be registered before the error handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * Usage: app.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });

    // In production, you might want to gracefully shutdown
    if (config.isProduction && !isOperationalError(reason)) {
      logger.error('Non-operational error detected, shutting down...');
      process.exit(1);
    }
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });

    // Always exit on uncaught exceptions
    logger.error('Uncaught exception detected, shutting down...');
    process.exit(1);
  });
};
