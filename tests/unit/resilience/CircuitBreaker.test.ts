import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, CircuitBreakerRegistry } from '../../../src/libs/resilience';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringPeriod: 500,
    });
  });

  it('should start in CLOSED state', () => {
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitState.CLOSED);
    expect(metrics.failureCount).toBe(0);
  });

  it('should allow operations when CLOSED', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await circuitBreaker.execute(operation);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should open circuit after failure threshold', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('failure'));
    
    // Fail 3 times to reach threshold
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitState.OPEN);
    expect(metrics.failureCount).toBe(3);
  });

  it('should reject operations when OPEN', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('failure'));
    
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    // Should reject immediately when open
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
    expect(operation).toHaveBeenCalledTimes(3); // Should not be called when open
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('failure'));
    
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Should allow one operation in HALF_OPEN state
    operation.mockResolvedValue('success');
    const result = await circuitBreaker.execute(operation);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(4); // Called again after timeout
  });

  it('should close circuit on successful operation in HALF_OPEN', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('failure'));
    
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    // Wait for reset timeout and succeed
    await new Promise(resolve => setTimeout(resolve, 1100));
    operation.mockResolvedValue('success');
    
    await circuitBreaker.execute(operation);
    
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitState.CLOSED);
    expect(metrics.failureCount).toBe(0);
  });

  it('should reset circuit manually', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('failure'));
    
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected to fail
      }
    }
    
    circuitBreaker.reset();
    
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitState.CLOSED);
    expect(metrics.failureCount).toBe(0);
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    // Reset the singleton instance for clean testing
    (CircuitBreakerRegistry as any).instance = undefined;
    registry = CircuitBreakerRegistry.getInstance();
  });

  it('should create new circuit breaker', () => {
    const config = {
      failureThreshold: 5,
      resetTimeout: 2000,
      monitoringPeriod: 1000,
    };
    
    const breaker = registry.get('test-service', config);
    
    expect(breaker).toBeDefined();
    const metrics = breaker.getMetrics();
    expect(metrics.failureCount).toBe(0);
  });

  it('should return existing circuit breaker', () => {
    const config = {
      failureThreshold: 5,
      resetTimeout: 2000,
      monitoringPeriod: 1000,
    };
    
    const breaker1 = registry.get('test-service', config);
    const breaker2 = registry.get('test-service');
    
    expect(breaker1).toBe(breaker2);
  });

  it('should throw error for non-existent breaker without config', () => {
    expect(() => registry.get('non-existent')).toThrow('Circuit breaker \'non-existent\' not found');
  });

  it('should get all metrics', () => {
    const config = {
      failureThreshold: 5,
      resetTimeout: 2000,
      monitoringPeriod: 1000,
    };
    
    registry.get('service1', config);
    registry.get('service2', config);
    
    const metrics = registry.getAllMetrics();
    
    expect(metrics).toHaveProperty('service1');
    expect(metrics).toHaveProperty('service2');
    expect(Object.keys(metrics)).toHaveLength(2);
  });
});