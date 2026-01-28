/**
 * Professional Logger Utility
 * Provides structured logging with environment-aware behavior
 */

interface LogContext {
    component?: string;
    action?: string;
    userId?: string;
    [key: string]: any;
}

class Logger {
    private isDevelopment = import.meta.env.DEV;

    /**
     * Debug logs - only in development
     */
    debug(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.log(`[DEBUG] ${message}`, context || '');
        }
    }

    /**
     * Info logs - only in development
     */
    info(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.info(`[INFO] ${message}`, context || '');
        }
    }

    /**
     * Warning logs - always logged
     */
    warn(message: string, context?: LogContext): void {
        console.warn(`[WARN] ${message}`, context || '');
        // TODO: Send to monitoring service (e.g., Sentry) in production
    }

    /**
     * Error logs - always logged and sent to monitoring
     */
    error(message: string, error?: Error | unknown, context?: LogContext): void {
        console.error(`[ERROR] ${message}`, {
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error,
            context
        });

        // TODO: Send to error tracking service (e.g., Sentry) in production
        if (!this.isDevelopment) {
            this.sendToMonitoring(message, error, context);
        }
    }

    /**
     * Performance measurement
     */
    time(label: string): void {
        if (this.isDevelopment) {
            console.time(label);
        }
    }

    timeEnd(label: string): void {
        if (this.isDevelopment) {
            console.timeEnd(label);
        }
    }

    /**
     * Send errors to monitoring service
     * @private
     */
    private sendToMonitoring(_message: string, _error?: Error | unknown, _context?: LogContext): void {
        // TODO: Implement Sentry or similar service integration
        // Example:
        // Sentry.captureException(error, {
        //     tags: { component: context?.component },
        //     extra: context
        // });
    }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogContext };
