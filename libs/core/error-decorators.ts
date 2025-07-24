import type { ErrorContext } from './error-boundary';
import { ErrorBoundary, ErrorSeverity, GameError } from './error-boundary';

/**
 * Decorator to automatically wrap methods with error boundaries
 * 
 * @example
 * ```typescript
 * class MySystem {
 *   @SafeMethod({ system: 'my-system' })
 *   processData(data: any): void {
 *     // This method is automatically wrapped with error boundary
 *   }
 * }
 * ```
 */
export function SafeMethod(context?: Partial<ErrorContext>) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const boundary = ErrorBoundary.getInstance();

        descriptor.value = function (this: any, ...args: any[]) {
            const methodContext: ErrorContext = {
                system: context?.system || target.constructor.name,
                action: context?.action || propertyKey,
                ...context
            };

            try {
                const result = originalMethod.apply(this, args);
                
                // Handle async methods
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        boundary.handleError(error, methodContext);
                        throw error;
                    });
                }
                
                return result;
            } catch (error) {
                boundary.handleError(error as Error, methodContext);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Decorator for methods that should continue on error
 * 
 * @example
 * ```typescript
 * class RenderSystem {
 *   @ContinueOnError({ severity: ErrorSeverity.LOW })
 *   renderParticles(): void {
 *     // If this fails, the game continues
 *   }
 * }
 * ```
 */
export function ContinueOnError(options?: {
    severity?: ErrorSeverity;
    fallbackValue?: any;
    context?: Partial<ErrorContext>;
}) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const boundary = ErrorBoundary.getInstance();

        descriptor.value = function (this: any, ...args: any[]) {
            const methodContext: ErrorContext = {
                system: options?.context?.system || target.constructor.name,
                action: options?.context?.action || propertyKey,
                ...options?.context
            };

            try {
                const result = originalMethod.apply(this, args);
                
                // Handle async methods
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        const gameError = new GameError(
                            error.message,
                            options?.severity || ErrorSeverity.LOW,
                            methodContext
                        );
                        boundary.handleError(gameError, methodContext);
                        return options?.fallbackValue ?? undefined;
                    });
                }
                
                return result;
            } catch (error) {
                const gameError = new GameError(
                    (error as Error).message,
                    options?.severity || ErrorSeverity.LOW,
                    methodContext
                );
                boundary.handleError(gameError, methodContext);
                return options?.fallbackValue ?? undefined;
            }
        };

        return descriptor;
    };
}

/**
 * Decorator for critical methods that should trigger recovery
 * 
 * @example
 * ```typescript
 * class NetworkSystem {
 *   @Critical({ recoveryStrategy: 'network' })
 *   sendGameState(): void {
 *     // If this fails, recovery will be attempted
 *   }
 * }
 * ```
 */
export function Critical(options?: {
    recoveryStrategy?: string;
    context?: Partial<ErrorContext>;
}) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const boundary = ErrorBoundary.getInstance();

        descriptor.value = function (this: any, ...args: any[]) {
            const methodContext: ErrorContext = {
                system: options?.context?.system || target.constructor.name,
                action: options?.context?.action || propertyKey,
                metadata: {
                    ...options?.context?.metadata,
                    recoveryStrategy: options?.recoveryStrategy
                }
            };

            try {
                const result = originalMethod.apply(this, args);
                
                // Handle async methods
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        const gameError = new GameError(
                            error.message,
                            ErrorSeverity.HIGH,
                            methodContext
                        );
                        boundary.handleError(gameError, methodContext);
                        throw error;
                    });
                }
                
                return result;
            } catch (error) {
                const gameError = new GameError(
                    (error as Error).message,
                    ErrorSeverity.HIGH,
                    methodContext
                );
                boundary.handleError(gameError, methodContext);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Decorator to retry methods on failure
 * 
 * @example
 * ```typescript
 * class DataService {
 *   @Retry({ attempts: 3, delay: 1000 })
 *   async fetchData(): Promise<Data> {
 *     // Will retry up to 3 times with 1s delay
 *   }
 * }
 * ```
 */
export function Retry(options: {
    attempts?: number;
    delay?: number;
    backoff?: boolean;
    context?: Partial<ErrorContext>;
} = {}) {
    const maxAttempts = options.attempts || 3;
    const baseDelay = options.delay || 1000;
    const useBackoff = options.backoff ?? true;

    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const boundary = ErrorBoundary.getInstance();

        descriptor.value = async function (this: any, ...args: any[]) {
            const methodContext: ErrorContext = {
                system: options.context?.system || target.constructor.name,
                action: options.context?.action || propertyKey,
                ...options.context
            };

            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    lastError = error as Error;
                    
                    if (attempt < maxAttempts) {
                        const delay = useBackoff ? baseDelay * attempt : baseDelay;
                        
                        const retryError = new GameError(
                            `Retry attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`,
                            ErrorSeverity.LOW,
                            {
                                ...methodContext,
                                metadata: {
                                    attempt,
                                    maxAttempts,
                                    delay
                                }
                            }
                        );
                        boundary.handleError(retryError);
                        
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            // All attempts failed
            const finalError = new GameError(
                `All ${maxAttempts} retry attempts failed: ${lastError?.message}`,
                ErrorSeverity.HIGH,
                methodContext
            );
            boundary.handleError(finalError);
            throw lastError!;
        };

        return descriptor;
    };
}