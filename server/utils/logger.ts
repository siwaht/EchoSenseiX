/**
 * Centralized logging utility for EchoSenseiX
 * Provides structured logging with different levels and automatic sanitization
 */

import { config } from '../config';

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Log entry interface
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

// Sensitive keys that should be redacted in logs
const SENSITIVE_KEYS = [
  'password',
  'apikey',
  'api_key',
  'token',
  'secret',
  'authorization',
  'cookie',
  'session',
  'credentials',
  'encryptionkey',
  'encryption_key',
];

/**
 * Sanitizes sensitive data from log context
 */
function sanitizeContext(context: any): any {
  if (!context || typeof context !== 'object') {
    return context;
  }

  if (Array.isArray(context)) {
    return context.map(sanitizeContext);
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive information
    const isSensitive = SENSITIVE_KEYS.some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey)
    );

    if (isSensitive) {
      // Redact sensitive values but show last 4 characters if it's a string
      if (typeof value === 'string' && value.length > 4) {
        sanitized[key] = `***${value.slice(-4)}`;
      } else {
        sanitized[key] = '***REDACTED***';
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Formats log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const { level, message, timestamp, context, error } = entry;
  
  let output = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (context && Object.keys(context).length > 0) {
    output += ` ${JSON.stringify(context)}`;
  }
  
  if (error) {
    output += `\n  Error: ${error.message}`;
    if (config.isDevelopment && error.stack) {
      output += `\n  Stack: ${error.stack}`;
    }
  }
  
  return output;
}

/**
 * Gets color code for log level (for terminal output)
 */
function getColorCode(level: LogLevel): string {
  const colors = {
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.INFO]: '\x1b[36m',  // Cyan
    [LogLevel.DEBUG]: '\x1b[90m', // Gray
  };
  return colors[level] || '';
}

/**
 * Logger class with structured logging methods
 */
class Logger {
  private minLevel: LogLevel;

  constructor() {
    // Set minimum log level based on environment
    this.minLevel = config.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  /**
   * Determines if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentIndex = levels.indexOf(this.minLevel);
    const requestedIndex = levels.indexOf(level);
    return requestedIndex <= currentIndex;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context ? sanitizeContext(context) : undefined,
      error,
    };

    const formattedMessage = formatLogEntry(entry);
    const colorCode = getColorCode(level);
    const resetCode = '\x1b[0m';

    // Output to console with color in development
    if (config.isDevelopment) {
      console.log(`${colorCode}${formattedMessage}${resetCode}`);
    } else {
      // In production, use standard console methods
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    // TODO: In production, also send to external logging service (e.g., CloudWatch, Datadog)
    // if (config.isProduction) {
    //   sendToExternalLogger(entry);
    // }
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, any>, error?: Error) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log HTTP request
   */
  http(method: string, path: string, statusCode: number, duration: number, context?: Record<string, any>) {
    const message = `${method} ${path} ${statusCode} in ${duration}ms`;
    
    if (statusCode >= 500) {
      this.error(message, context);
    } else if (statusCode >= 400) {
      this.warn(message, context);
    } else {
      this.info(message, context);
    }
  }

  /**
   * Log database query
   */
  query(operation: string, duration: number, context?: Record<string, any>) {
    const message = `DB ${operation} completed in ${duration}ms`;
    
    if (duration > 1000) {
      this.warn(`Slow query: ${message}`, context);
    } else {
      this.debug(message, context);
    }
  }

  /**
   * Log external API call
   */
  external(service: string, operation: string, success: boolean, duration: number, context?: Record<string, any>) {
    const message = `${service} ${operation} ${success ? 'succeeded' : 'failed'} in ${duration}ms`;
    
    if (!success) {
      this.error(message, context);
    } else if (duration > 5000) {
      this.warn(`Slow external call: ${message}`, context);
    } else {
      this.info(message, context);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
