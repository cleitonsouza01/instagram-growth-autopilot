import { logger } from "../utils/logger";
import {
  ActionBlockError,
  NotAuthenticatedError,
  CheckpointRequiredError,
  PlatformApiError,
} from "./errors";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/** Non-retryable errors - rethrow immediately */
function isNonRetryable(error: unknown): boolean {
  return (
    error instanceof ActionBlockError ||
    error instanceof NotAuthenticatedError ||
    error instanceof CheckpointRequiredError
  );
}

/**
 * Execute a function with exponential backoff retry.
 * Backoff formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryableStatuses } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Never retry non-retryable errors
      if (isNonRetryable(error)) {
        throw error;
      }

      // Check if status is retryable
      if (error instanceof PlatformApiError) {
        if (!retryableStatuses.includes(error.statusCode)) {
          throw error;
        }
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      logger.warn(
        "retry",
        `Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms`,
        { error: error instanceof Error ? error.message : String(error) },
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
