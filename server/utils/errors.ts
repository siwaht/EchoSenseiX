/**
 * Custom error classes for EchoSenseiX
 * Provides structured error handling with proper HTTP status codes
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: Record<string, any>;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid input data
 */
export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(400, message, true, 'VALIDATION_ERROR', { fields });
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, true, 'AUTH_ERROR');
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, true, 'AUTHORIZATION_ERROR');
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(404, message, true, 'NOT_FOUND', { resource, identifier });
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict - Resource already exists or conflict with current state
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(409, message, true, 'CONFLICT_ERROR', details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity - Request is well-formed but semantically incorrect
 */
export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(422, message, true, 'UNPROCESSABLE_ENTITY', details);
    Object.setPrototypeOf(this, UnprocessableEntityError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later', retryAfter?: number) {
    super(429, message, true, 'RATE_LIMIT_ERROR', { retryAfter });
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred', details?: Record<string, any>) {
    super(500, message, false, 'INTERNAL_ERROR', details);
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * 502 Bad Gateway - External service error
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: Record<string, any>) {
    super(502, `${service} error: ${message}`, true, 'EXTERNAL_SERVICE_ERROR', {
      service,
      ...details,
    });
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', retryAfter?: number) {
    super(503, message, true, 'SERVICE_UNAVAILABLE', { retryAfter });
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Database-specific errors
 */
export class DatabaseError extends AppError {
  constructor(operation: string, message: string, details?: Record<string, any>) {
    super(500, `Database ${operation} failed: ${message}`, false, 'DATABASE_ERROR', {
      operation,
      ...details,
    });
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(500, `Configuration error: ${message}`, false, 'CONFIG_ERROR', details);
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: any): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Helper to create error response object
 */
export function formatErrorResponse(error: AppError) {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  };
}
