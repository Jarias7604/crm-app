/**
 * Custom Error Classes for Better Error Handling
 */

export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public context?: Record<string, any>
    ) {
        super(message);
        this.name = 'AppError';

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Not authenticated', context?: Record<string, any>) {
        super(message, 'AUTH_REQUIRED', 401, context);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Not authorized', context?: Record<string, any>) {
        super(message, 'AUTH_FORBIDDEN', 403, context);
        this.name = 'AuthorizationError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'VALIDATION_ERROR', 400, context);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, context?: Record<string, any>) {
        super(`${resource} not found`, 'NOT_FOUND', 404, context);
        this.name = 'NotFoundError';
    }
}

export class DatabaseError extends AppError {
    constructor(message: string, context?: Record<string, any>) {
        super(message, 'DATABASE_ERROR', 500, context);
        this.name = 'DatabaseError';
    }
}
