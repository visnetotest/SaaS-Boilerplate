export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  requestId?: string;
  service?: string;
  version?: string;
}

export interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  emailConfig?: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    to: string[];
  };
  slackConfig?: {
    webhookUrl: string;
    channel?: string;
  };
  thresholds: {
    errorRate: number; // percentage
    responseTime: number; // milliseconds
    criticalErrors: number; // count per minute
  };
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableMetrics: boolean;
  alertConfig?: AlertConfig;
}

export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private metrics = {
    totalLogs: 0,
    errorCount: 0,
    criticalCount: 0,
    responseTimeSum: 0,
    responseTimeCount: 0,
    lastMinuteErrors: [] as LogEntry[],
  };

  private constructor(config: LoggerConfig) {
    this.config = config;
  }

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      if (!config) {
        throw new Error('Logger config required for first initialization');
      }
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  critical(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (level < this.config.level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.APP_VERSION || 'unknown',
      requestId: this.generateRequestId(),
    };

    this.updateMetrics(entry);
    this.writeLog(entry);
    this.checkAlerts(entry);
  }

  private updateMetrics(entry: LogEntry): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalLogs++;

    if (entry.level >= LogLevel.ERROR) {
      this.metrics.errorCount++;
      this.metrics.lastMinuteErrors.push(entry);
    }

    if (entry.level === LogLevel.CRITICAL) {
      this.metrics.criticalCount++;
    }

    // Clean old errors (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.metrics.lastMinuteErrors = this.metrics.lastMinuteErrors.filter(
      e => new Date(e.timestamp).getTime() > oneMinuteAgo
    );

    // Track response times if provided in context
    if (entry.context?.responseTime) {
      this.metrics.responseTimeSum += entry.context.responseTime;
      this.metrics.responseTimeCount++;
    }
  }

  private writeLog(entry: LogEntry): void {
    const formatted = this.config.format === 'json' 
      ? JSON.stringify(entry) 
      : this.formatText(entry);

    if (this.config.enableConsole) {
      this.writeToConsole(entry.level, formatted);
    }

    if (this.config.enableFile && this.config.filePath) {
      this.writeToFile(formatted);
    }
  }

  private writeToConsole(level: LogLevel, message: string): void {
    const method = level >= LogLevel.ERROR ? 'error' : 
                   level === LogLevel.WARN ? 'warn' : 
                   level === LogLevel.INFO ? 'info' : 'debug';
    
    console[method](message);
  }

  private writeToFile(message: string): void {
    // In a real implementation, you'd use a proper file logging library
    // For now, this is a placeholder
    console.log(`[FILE LOG] ${message}`);
  }

  private formatText(entry: LogEntry): string {
    const levelStr = LogLevel[entry.level].padEnd(8);
    const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
    const errorStr = entry.error ? ` | ${entry.error.stack}` : '';
    
    return `${entry.timestamp} | ${levelStr} | ${entry.message}${contextStr}${errorStr}`;
  }

  private checkAlerts(entry: LogEntry): void {
    if (!this.config.alertConfig?.enabled) return;

    const alertConfig = this.config.alertConfig;
    const alerts: string[] = [];

    // Check error rate threshold
    const errorRate = this.calculateErrorRate();
    if (errorRate > alertConfig.thresholds.errorRate) {
      alerts.push(`Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${alertConfig.thresholds.errorRate}%)`);
    }

    // Check response time threshold
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > alertConfig.thresholds.responseTime) {
      alerts.push(`Average response time (${avgResponseTime}ms) exceeds threshold (${alertConfig.thresholds.responseTime}ms)`);
    }

    // Check critical errors threshold
    if (this.metrics.lastMinuteErrors.length > alertConfig.thresholds.criticalErrors) {
      alerts.push(`Critical errors per minute (${this.metrics.lastMinuteErrors.length}) exceeds threshold (${alertConfig.thresholds.criticalErrors})`);
    }

    // Send alerts if any thresholds exceeded
    if (alerts.length > 0) {
      this.sendAlerts(alerts, entry);
    }
  }

  private calculateErrorRate(): number {
    if (this.metrics.totalLogs === 0) return 0;
    return (this.metrics.errorCount / this.metrics.totalLogs) * 100;
  }

  private calculateAverageResponseTime(): number {
    if (this.metrics.responseTimeCount === 0) return 0;
    return this.metrics.responseTimeSum / this.metrics.responseTimeCount;
  }

  private async sendAlerts(alerts: string[], entry: LogEntry): Promise<void> {
    const alertMessage = `🚨 System Alerts:\n${alerts.join('\n')}\n\nLatest Log: ${entry.message}`;
    
    try {
      // Send webhook alert
      if (this.config.alertConfig?.webhookUrl) {
        await this.sendWebhookAlert(alertMessage);
      }

      // Send Slack alert
      if (this.config.alertConfig?.slackConfig?.webhookUrl) {
        await this.sendSlackAlert(alertMessage);
      }

      // Send email alert
      if (this.config.alertConfig?.emailConfig) {
        await this.sendEmailAlert(alertMessage);
      }
    } catch (error) {
      console.error('Failed to send alerts:', error);
    }
  }

  private async sendWebhookAlert(message: string): Promise<void> {
    // Implementation would depend on your webhook service
    console.log(`[WEBHOOK ALERT] ${message}`);
  }

  private async sendSlackAlert(message: string): Promise<void> {
    // Implementation would use Slack API
    console.log(`[SLACK ALERT] ${message}`);
  }

  private async sendEmailAlert(message: string): Promise<void> {
    // Implementation would use nodemailer or similar
    console.log(`[EMAIL ALERT] ${message}`);
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.calculateErrorRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      criticalCount: 0,
      responseTimeSum: 0,
      responseTimeCount: 0,
      lastMinuteErrors: [],
    };
  }
}

// Performance monitoring decorator
export function logPerformance(
  logger: Logger,
  operationName: string
) {
  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        logger.info(`Operation completed: ${operationName}`, {
          operationName,
          duration,
          success: true,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`Operation failed: ${operationName}`, error as Error, {
          operationName,
          duration,
          success: false,
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}

// Error boundary for React components
export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export class ErrorLogger {
  static logComponentError(
    logger: Logger,
    error: Error,
    errorInfo: any,
    componentName: string
  ): void {
    logger.critical(
      `React component error in ${componentName}`,
      error,
      {
        componentName,
        errorInfo,
        stack: error.stack,
      }
    );
  }

  static logApiError(
    logger: Logger,
    error: any,
    request: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: any;
    },
    response?: {
      status: number;
      headers?: Record<string, string>;
      body?: any;
    }
  ): void {
    logger.error(
      `API request failed: ${request.method} ${request.url}`,
      error instanceof Error ? error : new Error(String(error)),
      {
        request: {
          url: request.url,
          method: request.method,
          headers: request.headers,
        },
        response: response ? {
          status: response.status,
          headers: response.headers,
        } : undefined,
      }
    );
  }
}