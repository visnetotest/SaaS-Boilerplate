import { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerRegistry } from './CircuitBreaker';
import { Retry, RetryConfig } from './Retry';

export interface ResilienceConfig {
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  fallback?: (error: any) => any;
  timeout?: number;
}

export class ResilientOperation {
  private circuitBreaker?: CircuitBreaker;
  private config: ResilienceConfig;

  constructor(
    name: string,
    config: ResilienceConfig = {}
  ) {
    this.config = config;
    
    if (config.circuitBreaker) {
      this.circuitBreaker = CircuitBreakerRegistry.getInstance().get(name, config.circuitBreaker);
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const wrappedOperation = this.wrapOperation(operation);
    
    try {
      if (this.circuitBreaker) {
        return await this.circuitBreaker.execute(wrappedOperation);
      } else {
        return await wrappedOperation();
      }
    } catch (error) {
      if (this.config.fallback) {
        return this.config.fallback(error);
      }
      throw error;
    }
  }

  private wrapOperation<T>(operation: () => Promise<T>): () => Promise<T> {
    let wrapped = operation;

    // Add timeout if configured
    if (this.config.timeout) {
      const original = wrapped;
      wrapped = () => Promise.race([
        original(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout)
        )
      ]);
    }

    // Add retry if configured
    if (this.config.retry) {
      wrapped = () => Retry.execute(wrapped, this.config.retry);
    }

    return wrapped;
  }

  getMetrics() {
    return {
      circuitBreaker: this.circuitBreaker?.getMetrics(),
      config: this.config,
    };
  }

  reset(): void {
    this.circuitBreaker?.reset();
  }

  forceOpen(): void {
    this.circuitBreaker?.forceOpen();
  }

  forceClose(): void {
    this.circuitBreaker?.forceClose();
  }
}

// Factory function for creating resilient operations
export function createResilientOperation(
  name: string,
  config: ResilienceConfig = {}
): ResilientOperation {
  return new ResilientOperation(name, config);
}

// Higher-order function for wrapping functions with resilience
export function withResilience<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  config: ResilienceConfig = {}
): T {
  const operation = createResilientOperation(name, config);
  
  return (async (...args: Parameters<T>) => {
    return operation.execute(() => fn(...args));
  }) as T;
}

// Common configurations for different types of operations
export const CommonResilienceConfigs = {
  // For critical external APIs
  critical: {
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 30000, // 30 seconds
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: Retry.isRetryableError,
    },
    timeout: 30000, // 30 seconds
  },

  // For non-critical external services
  nonCritical: {
    circuitBreaker: {
      failureThreshold: 10,
      resetTimeout: 120000, // 2 minutes
      monitoringPeriod: 60000, // 1 minute
    },
    retry: {
      maxAttempts: 2,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: Retry.isRetryableError,
    },
    timeout: 15000, // 15 seconds
  },

  // For database operations
  database: {
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 15000, // 15 seconds
    },
    retry: {
      maxAttempts: 2,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: Retry.isRetryableError,
    },
    timeout: 10000, // 10 seconds
  },

  // For file operations
  fileSystem: {
    retry: {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: false,
    },
    timeout: 5000, // 5 seconds
  },
} as const;