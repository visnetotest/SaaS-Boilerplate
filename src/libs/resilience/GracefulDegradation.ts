export interface FallbackConfig<T> {
  primary: () => Promise<T>;
  fallbacks: Array<() => Promise<T>>;
  finalFallback?: () => T | Promise<T>;
  timeout?: number;
  onFallback?: (level: number, error: any) => void;
}

export class GracefulDegradation {
  static async execute<T>(config: FallbackConfig<T>): Promise<T> {
    let lastError: any;

    // Try primary operation
    try {
      if (config.timeout) {
        return await Promise.race([
          config.primary(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Primary operation timeout')), config.timeout)
          )
        ]);
      } else {
        return await config.primary();
      }
    } catch (error) {
      lastError = error;
      config.onFallback?.(0, error);
    }

    // Try fallbacks in order
    for (let i = 0; i < config.fallbacks.length; i++) {
      try {
        const fallback = config.fallbacks[i];
        if (!fallback) continue;
        const result = await fallback();
        config.onFallback?.(i + 1, null);
        return result;
      } catch (error) {
        lastError = error;
        config.onFallback?.(i + 1, error);
      }
    }

    // Try final fallback if available
    if (config.finalFallback) {
      try {
        const result = await config.finalFallback();
        config.onFallback?.(config.fallbacks.length + 1, null);
        return result;
      } catch (error) {
        lastError = error;
        config.onFallback?.(config.fallbacks.length + 1, error);
      }
    }

    // All options failed
    throw new Error(
      `All operations failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  static createCachedFallback<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl: number = 300000 // 5 minutes default
  ): () => Promise<T> {
    const cache = new Map<string, { data: T; timestamp: number }>();

    return async () => {
      const cached = cache.get(key);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < ttl) {
        return cached.data;
      }

      try {
        const data = await fallback();
        cache.set(key, { data, timestamp: now });
        return data;
      } catch (error) {
        // Return stale cache if available
        if (cached) {
          return cached.data;
        }
        throw error;
      }
    };
  }

  static createStaticFallback<T>(data: T): () => Promise<T> {
    return () => Promise.resolve(data);
  }

  static createNullFallback<T>(): () => Promise<T> {
    return () => {
      throw new Error('No fallback available');
    };
  }
}

// Service health checker for graceful degradation
export interface ServiceHealth {
  name: string;
  isHealthy: () => Promise<boolean>;
  checkInterval: number;
  lastCheck?: number;
  lastStatus?: boolean;
}

export class ServiceHealthMonitor {
  private services = new Map<string, ServiceHealth>();
  private intervals = new Map<string, NodeJS.Timeout>();

  addService(service: ServiceHealth): void {
    this.services.set(service.name, service);
    this.startMonitoring(service);
  }

  removeService(name: string): void {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
    this.services.delete(name);
  }

  private startMonitoring(service: ServiceHealth): void {
    const interval = setInterval(async () => {
      try {
        service.lastCheck = Date.now();
        service.lastStatus = await service.isHealthy();
      } catch (error) {
        service.lastStatus = false;
        console.error(`Health check failed for ${service.name}:`, error);
      }
    }, service.checkInterval);

    this.intervals.set(service.name, interval);
  }

  isHealthy(name: string): boolean {
    const service = this.services.get(name);
    return service?.lastStatus ?? false;
  }

  getAllHealth(): Record<string, { healthy: boolean; lastCheck?: number }> {
    const health: Record<string, { healthy: boolean; lastCheck?: number }> = {};
    
    for (const [name, service] of this.services) {
      health[name] = {
        healthy: service.lastStatus ?? false,
        lastCheck: service.lastCheck,
      };
    }
    
    return health;
  }

  stop(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}

// Content delivery with graceful degradation
export interface ContentDeliveryConfig<T> {
  sources: Array<{
    name: string;
    priority: number;
    fetch: () => Promise<T>;
    isAvailable?: () => Promise<boolean>;
  }>;
  cache?: {
    ttl: number;
    maxSize: number;
  };
  fallback?: T;
}

export class ContentDelivery<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private config: ContentDeliveryConfig<T>;

  constructor(config: ContentDeliveryConfig<T>) {
    this.config = config;
  }

  async getContent(key?: string): Promise<T> {
    // Check cache first
    if (key && this.config.cache) {
      const cached = this.cache.get(key);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < this.config.cache.ttl) {
        return cached.data;
      }
    }

    // Try sources in priority order
    const sortedSources = [...this.config.sources].sort((a, b) => a.priority - b.priority);
    
    for (const source of sortedSources) {
      try {
        // Check if source is available
        if (source.isAvailable && !(await source.isAvailable())) {
          continue;
        }

        const data = await source.fetch();
        
        // Cache the result
        if (key && this.config.cache) {
          this.manageCacheSize();
          this.cache.set(key, { data, timestamp: Date.now() });
        }
        
        return data;
      } catch (error) {
        console.warn(`Failed to fetch from ${source.name}:`, error);
        continue;
      }
    }

    // Return fallback if available
    if (this.config.fallback !== undefined) {
      return this.config.fallback;
    }

    throw new Error('All content sources failed and no fallback available');
  }

  private manageCacheSize(): void {
    if (!this.config.cache) return;

    if (this.cache.size >= this.config.cache.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.cache?.maxSize || 0,
    };
  }
}