/**
 * Security middleware for production hardening
 * Adds HTTP security headers and other protective measures
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Security headers middleware
 * Implements best practices for HTTP security headers
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Strict Transport Security - enforce HTTPS in production
  if (config.isProduction) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // XSS Protection (legacy, but still useful for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy - control information sent in Referer header
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self' https://api.elevenlabs.io https://api.stripe.com https://api.openai.com wss: ws:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // Only set CSP in production (can break dev tools in development)
  if (config.isProduction) {
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  }

  // Permissions Policy - control browser features
  const permissionsPolicy = [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=(self)', // Allow microphone for voice features
    'payment=(self)',
    'usb=()',
  ];
  res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));

  next();
}

/**
 * Request sanitization middleware
 * Removes potentially dangerous characters from request parameters
 */
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }

  // Sanitize URL parameters
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeString(req.params[key]);
      }
    }
  }

  next();
}

/**
 * Basic string sanitization - removes null bytes and trims
 */
function sanitizeString(str: string): string {
  return str
    .replace(/\0/g, '') // Remove null bytes
    .trim();
}

/**
 * CORS configuration for production
 */
export function getCorsOptions() {
  const allowedOrigins = config.isProduction
    ? [
      config.publicUrl,
      config.baseDomain ? `https://*.${config.baseDomain}` : null,
    ].filter(Boolean)
    : ['*'];

  return {
    origin: config.isProduction
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
          // Allow requests with no origin (like mobile apps or curl)
          callback(null, true);
          return;
        }

        const isAllowed = allowedOrigins.some((allowed) => {
          if (allowed === '*') return true;
          if (typeof allowed === 'string' && allowed.includes('*')) {
            const regex = new RegExp('^' + allowed.replace('*', '.*') + '$');
            return regex.test(origin);
          }
          return allowed === origin;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  };
}

/**
 * API version header middleware
 */
export function apiVersionHeader(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Powered-By', 'EchoSenseiX');
  next();
}

