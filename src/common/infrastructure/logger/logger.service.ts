import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class LoggerService implements NestLoggerService {
  log(message: string, context?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  }

  error(message: string, trace?: string, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, context ? JSON.stringify(context) : '', trace || '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
  }

  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${message}`, context ? JSON.stringify(context) : '');
  }

  verbose(message: string, context?: Record<string, unknown>): void {
    console.log(`[VERBOSE] ${message}`, context ? JSON.stringify(context) : '');
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(message, context);
  }
}
