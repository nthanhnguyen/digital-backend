import { promisify } from 'util';

const promisifiedSleep = promisify(setTimeout);

export class MaxAttemptError extends Error {
  innerError: Error;
  constructor(e: Error) {
    super();
    this.innerError = e;
  }
}

export interface RetryOptions {
  maxAttempts: number;
  backOff?: number;
  doRetry?: (e: unknown) => boolean;
}

type MethodDescriptor = TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>;

export function Retry(
  options: RetryOptions,
): (target: unknown, propertyKey: string, descriptor: MethodDescriptor) => MethodDescriptor {
  async function retryAsync(
    fn: (...args: unknown[]) => Promise<unknown>,
    args: unknown[],
    maxAttempts: number,
    backOff?: number,
    doRetry?: (e: unknown) => boolean,
  ): Promise<unknown> {
    try {
      return await fn.apply(this, args);
    } catch (e) {
      if (--maxAttempts < 0) {
        throw new MaxAttemptError(e);
      } else if (doRetry && !doRetry(e)) {
        throw e;
      }

      if (backOff) {
        await promisifiedSleep(backOff);
      }

      return retryAsync.apply(this, [fn, args, maxAttempts, backOff, doRetry]);
    }
  }

  return function (
    target: unknown,
    propertyKey: string,
    descriptor: MethodDescriptor,
  ): MethodDescriptor {
    const originalFn = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      try {
        return await retryAsync.apply(this, [
          originalFn,
          args,
          options.maxAttempts,
          options.backOff,
          options.doRetry,
        ]);
      } catch (e) {
        if (e instanceof MaxAttemptError) {
          throw e.innerError;
        }
        throw e;
      }
    };
    return descriptor;
  };
}
