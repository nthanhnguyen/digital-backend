import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CustomError } from '../errors/custom.error';
import { LoggerService } from '../infrastructure/logger';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessage = (exception as Error)?.message || 'Internal Server Error';
    const requestId = request.headers['x-request-id'] || 'N/A';

    // Log error for debugging
    this.logger.error('Exception caught', (exception as Error)?.stack, {
      status,
      message: errorMessage,
      path: request.url,
      requestId,
    });

    if (exception instanceof CustomError) {
      response.status(status).json({
        statusCode: status,
        code: exception.code || `ERR_${status}`,
        title: exception.title,
        message: errorMessage,
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    } else if (exception instanceof HttpException) {
      // Get the full response from HttpException (includes validation errors)
      const exceptionResponse = exception.getResponse();
      const errorResponse: Record<string, unknown> = {
        statusCode: status,
        code: `ERR_${status}`,
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      // Handle validation errors (from class-validator)
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // If it has a 'message' field that's an array, it's likely validation errors
        if (Array.isArray(responseObj.message)) {
          errorResponse.message = responseObj.message;
          errorResponse.error = responseObj.error || 'Bad Request';
        } else {
          errorResponse.message = responseObj.message || errorMessage;
        }
      } else {
        errorResponse.message = errorMessage;
      }

      response.status(status).json(errorResponse);
    } else {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'ERR_500',
        message: 'Internal Server Error',
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}
