/**
 * Type for HTTP errors that may have a response property
 * Used for Axios and similar HTTP client errors
 */
export interface HttpErrorWithResponse extends Error {
  response?: {
    status?: number;
    data?: unknown;
    statusText?: string;
  };
}

/**
 * Type guard to check if an error has a response property
 */
export function isHttpErrorWithResponse(error: unknown): error is HttpErrorWithResponse {
  return (
    error instanceof Error &&
    'response' in error &&
    typeof (error as HttpErrorWithResponse).response === 'object'
  );
}
