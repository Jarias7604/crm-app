import * as Sentry from '@sentry/react';

/**
 * Professional Logger — Multi-tenant CRM
 * Dev: logs to console | Prod: sends errors to Sentry automatically
 */

interface LogContext {
    component?: string;
    action?: string;
    userId?: string;
    companyId?: string;
    [key: string]: any;
}

class Logger {
    private isDevelopment = import.meta.env.DEV;

    /** Debug — only visible in local dev */
    debug(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.log(`[DEBUG] ${message}`, context || '');
        }
    }

    /** Info — only visible in local dev */
    info(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.info(`[INFO] ${message}`, context || '');
        }
    }

    /** Warning — logged in dev, sent to Sentry in prod */
    warn(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.warn(`[WARN] ${message}`, context || '');
        }
        Sentry.withScope((scope) => {
            if (context) scope.setExtras(context);
            scope.setLevel('warning');
            Sentry.captureMessage(message);
        });
    }

    /** Error — always logged, always sent to Sentry */
    error(message: string, error?: Error | unknown, context?: LogContext): void {
        if (this.isDevelopment) {
            console.error(`[ERROR] ${message}`, {
                error: error instanceof Error
                    ? { message: error.message, stack: error.stack, name: error.name }
                    : error,
                context
            });
        }

        Sentry.withScope((scope) => {
            if (context?.userId) scope.setUser({ id: context.userId });
            if (context?.companyId) scope.setTag('company_id', context.companyId);
            if (context?.component) scope.setTag('component', context.component);
            if (context) scope.setExtras(context);
            scope.setLevel('error');

            if (error instanceof Error) {
                Sentry.captureException(error);
            } else {
                Sentry.captureMessage(`${message}: ${JSON.stringify(error ?? '')}`);
            }
        });
    }

    /** Performance timing — dev only */
    time(label: string): void {
        if (this.isDevelopment) console.time(label);
    }

    timeEnd(label: string): void {
        if (this.isDevelopment) console.timeEnd(label);
    }
}

export const logger = new Logger();
export type { LogContext };
