import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to capture request context (trace ID, user info, etc.)
 * This allows logging and other services to access request-specific data
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware<Request, Response> {
  use(req: Request, res: Response, next: () => void): void {
    // Generate or extract trace ID for distributed tracing
    const traceId = (req.headers['x-trace-id'] as string) || uuidv4();

    // Attach to request for access in controllers/services
    (req as Request & { traceId?: string }).traceId = traceId;

    // Add to response headers
    res.setHeader('x-trace-id', traceId);

    next();
  }
}
