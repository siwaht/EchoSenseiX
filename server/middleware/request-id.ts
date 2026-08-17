/**
 * Request ID middleware for distributed tracing
 * Attaches a unique ID to every request for log correlation
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const HEADER_NAME = 'X-Request-Id';

declare global {
  // Express request augmentation requires a namespace declaration.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use existing request ID from upstream proxy, or generate one
  const requestId = (req.headers[HEADER_NAME.toLowerCase()] as string)
    || randomBytes(12).toString('hex');

  req.requestId = requestId;
  res.setHeader(HEADER_NAME, requestId);
  next();
}
