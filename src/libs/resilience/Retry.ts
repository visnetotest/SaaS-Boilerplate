export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: any,
    public errors: any[]
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export class Retry {
  static async execute<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...config,
    };

    let lastError: any;
    const errors: any[] = [];

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        errors.push(error);

        // Check if error is retryable
        if (finalConfig.retryableErrors && !finalConfig.retryableErrors(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === finalConfig.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        let delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
          finalConfig.maxDelay
        );

        // Add jitter to prevent thundering herd
        if (finalConfig.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        // Call retry callback if provided
        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt, error);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new RetryError(
      `Operation failed after ${finalConfig.maxAttempts} attempts`,
      finalConfig.maxAttempts,
      lastError,
      errors
    );
  }

  static isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 429 || status === 408;
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return true;
    }

    return false;
  }

  static createBackoffDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    multiplier: number = 2,
    jitter: boolean = true
  ): number {
    let delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
    
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return delay;
  }
}

// Decorator for automatic retry
export function withRetry(config: Partial<RetryConfig> = {}) {
  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return Retry.execute(() => method.apply(this, args), config);
    };

    return descriptor;
  };
}

// Higher-order function for wrapping functions with retry
export function withRetryFn<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return Retry.execute(() => fn(...args), config);
  }) as T;
}