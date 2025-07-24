/**
 * Error Boundary System for Phaser Game
 * Provides comprehensive error handling and recovery strategies
 */

import { Scene } from 'phaser';
import { createLogger, type ModuleLogger } from './logger';

export interface ErrorContext {
    scene?: Scene;
    system?: string;
    action?: string;
    metadata?: Record<string, unknown>;
}

export interface ErrorRecoveryStrategy {
    canRecover(error: Error, context: ErrorContext): boolean;
    recover(error: Error, context: ErrorContext): Promise<void>;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',        // Log and continue
    MEDIUM = 'medium',  // Log, notify user, continue
    HIGH = 'high',      // Log, notify user, attempt recovery
    CRITICAL = 'critical' // Log, notify user, reload game
}

/**
 * Base class for game-specific errors
 */
export class GameError extends Error {
    public readonly severity: ErrorSeverity;
    public readonly context?: ErrorContext;
    public readonly timestamp: number;

    constructor(message: string, severity: ErrorSeverity, context?: ErrorContext) {
        super(message);
        this.name = this.constructor.name;
        this.severity = severity;
        this.context = context;
        this.timestamp = Date.now();
        
        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends GameError {
    constructor(message: string, context?: ErrorContext) {
        super(message, ErrorSeverity.HIGH, context);
    }
}

/**
 * Asset loading errors
 */
export class AssetError extends GameError {
    constructor(message: string, context?: ErrorContext) {
        super(message, ErrorSeverity.HIGH, context);
    }
}

/**
 * Game state errors
 */
export class GameStateError extends GameError {
    constructor(message: string, context?: ErrorContext) {
        super(message, ErrorSeverity.MEDIUM, context);
    }
}

/**
 * Physics/collision errors
 */
export class PhysicsError extends GameError {
    constructor(message: string, context?: ErrorContext) {
        super(message, ErrorSeverity.LOW, context);
    }
}

/**
 * Main Error Boundary class
 */
export class ErrorBoundary {
    private static instance: ErrorBoundary;
    private logger: ModuleLogger;
    private recoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();
    private errorHistory: GameError[] = [];
    private readonly MAX_ERROR_HISTORY = 100;
    private errorHandlers: Map<string, (error: GameError) => void> = new Map();

    private constructor() {
        this.logger = createLogger('ErrorBoundary');
        this.setupGlobalErrorHandlers();
        this.registerDefaultRecoveryStrategies();
    }

    public static getInstance(): ErrorBoundary {
        if (!ErrorBoundary.instance) {
            ErrorBoundary.instance = new ErrorBoundary();
        }
        return ErrorBoundary.instance;
    }

    /**
     * Setup global error handlers
     */
    private setupGlobalErrorHandlers(): void {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.handleError(new GameError(
                `Uncaught error: ${event.message}`,
                ErrorSeverity.HIGH,
                { action: 'global-error' }
            ));
            event.preventDefault();
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(new GameError(
                `Unhandled promise rejection: ${event.reason}`,
                ErrorSeverity.HIGH,
                { action: 'promise-rejection' }
            ));
            event.preventDefault();
        });
    }

    /**
     * Register default recovery strategies
     */
    private registerDefaultRecoveryStrategies(): void {
        // Network error recovery
        this.registerRecoveryStrategy('network', {
            canRecover: (error) => error instanceof NetworkError,
            recover: async (error, context) => {
                this.logger.warn('Attempting network recovery...', { error: error.message });
                // Attempt to reconnect
                if (context.scene) {
                    const scene = context.scene as any;
                    if (scene.dbConnectionManager) {
                        try {
                            await scene.dbConnectionManager.reconnect();
                            this.logger.info('Network recovery successful');
                        } catch (e) {
                            this.logger.error('Network recovery failed', { error: e });
                            throw e;
                        }
                    }
                }
            }
        });

        // Asset error recovery
        this.registerRecoveryStrategy('asset', {
            canRecover: (error) => error instanceof AssetError,
            recover: async (error, context) => {
                this.logger.warn('Attempting asset recovery...', { error: error.message });
                // Reload failed assets
                if (context.scene) {
                    try {
                        await this.reloadSceneAssets(context.scene);
                        this.logger.info('Asset recovery successful');
                    } catch (e) {
                        this.logger.error('Asset recovery failed', { error: e });
                        throw e;
                    }
                }
            }
        });

        // Game state error recovery
        this.registerRecoveryStrategy('gamestate', {
            canRecover: (error) => error instanceof GameStateError,
            recover: async (error, context) => {
                this.logger.warn('Attempting game state recovery...', { error: error.message });
                // Reset to safe state
                if (context.scene) {
                    try {
                        await this.resetToSafeState(context.scene);
                        this.logger.info('Game state recovery successful');
                    } catch (e) {
                        this.logger.error('Game state recovery failed', { error: e });
                        throw e;
                    }
                }
            }
        });
    }

    /**
     * Wrap a function with error boundary protection
     */
    public wrap<T extends (...args: any[]) => any>(
        fn: T,
        context: ErrorContext
    ): T {
        const boundary = this;
        return function wrappedFunction(this: any, ...args: Parameters<T>): ReturnType<T> {
            try {
                const result = fn.apply(this, args);
                
                // Handle async functions
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        boundary.handleError(error, context);
                        throw error;
                    }) as ReturnType<T>;
                }
                
                return result;
            } catch (error) {
                boundary.handleError(error as Error, context);
                throw error;
            }
        } as T;
    }

    /**
     * Wrap a Phaser scene method with error boundary
     */
    public wrapSceneMethod<T extends (...args: any[]) => any>(
        scene: Scene,
        methodName: string,
        method: T
    ): void {
        const context: ErrorContext = {
            scene,
            system: 'scene',
            action: methodName
        };
        
        (scene as any)[methodName] = this.wrap(method.bind(scene), context);
    }

    /**
     * Handle an error
     */
    public handleError(error: Error, context?: ErrorContext): void {
        // Convert to GameError if needed
        const gameError = error instanceof GameError 
            ? error 
            : new GameError(error.message, ErrorSeverity.MEDIUM, context);

        // Add to history
        this.addToHistory(gameError);

        // Log the error
        this.logError(gameError);

        // Notify handlers
        this.notifyHandlers(gameError);

        // Attempt recovery based on severity
        this.attemptRecovery(gameError).catch((recoveryError) => {
            this.logger.error('Recovery failed', { 
                originalError: gameError.message,
                recoveryError 
            });
            
            // If recovery fails and it's critical, reload the game
            if (gameError.severity === ErrorSeverity.CRITICAL) {
                this.reloadGame();
            }
        });
    }

    /**
     * Register a recovery strategy
     */
    public registerRecoveryStrategy(name: string, strategy: ErrorRecoveryStrategy): void {
        this.recoveryStrategies.set(name, strategy);
    }

    /**
     * Register an error handler
     */
    public registerErrorHandler(name: string, handler: (error: GameError) => void): void {
        this.errorHandlers.set(name, handler);
    }

    /**
     * Add error to history
     */
    private addToHistory(error: GameError): void {
        this.errorHistory.push(error);
        
        // Trim history if needed
        if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
            this.errorHistory.shift();
        }
    }

    /**
     * Log error based on severity
     */
    private logError(error: GameError): void {
        const logData = {
            message: error.message,
            stack: error.stack,
            context: error.context,
            timestamp: error.timestamp
        };

        switch (error.severity) {
            case ErrorSeverity.LOW:
                this.logger.debug('Low severity error', logData);
                break;
            case ErrorSeverity.MEDIUM:
                this.logger.warn('Medium severity error', logData);
                break;
            case ErrorSeverity.HIGH:
                this.logger.error('High severity error', logData);
                break;
            case ErrorSeverity.CRITICAL:
                this.logger.error('CRITICAL ERROR', logData);
                break;
        }
    }

    /**
     * Notify registered error handlers
     */
    private notifyHandlers(error: GameError): void {
        for (const handler of this.errorHandlers.values()) {
            try {
                handler(error);
            } catch (handlerError) {
                this.logger.error('Error in error handler', { error: handlerError });
            }
        }
    }

    /**
     * Attempt to recover from error
     */
    private async attemptRecovery(error: GameError): Promise<void> {
        // Don't attempt recovery for low severity errors
        if (error.severity === ErrorSeverity.LOW) {
            return;
        }

        // Try each recovery strategy
        for (const strategy of this.recoveryStrategies.values()) {
            if (strategy.canRecover(error, error.context || {})) {
                try {
                    await strategy.recover(error, error.context || {});
                    this.logger.info('Recovery successful', { 
                        error: error.message,
                        strategy: strategy.constructor.name 
                    });
                    return;
                } catch (recoveryError) {
                    this.logger.warn('Recovery strategy failed', { 
                        error: recoveryError,
                        strategy: strategy.constructor.name 
                    });
                }
            }
        }

        // No recovery strategy worked
        if (error.severity === ErrorSeverity.CRITICAL) {
            this.logger.error('No recovery possible for critical error', { error: error.message });
        }
    }

    /**
     * Reload scene assets
     */
    private async reloadSceneAssets(scene: Scene): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Stop current scene
                scene.scene.stop();
                
                // Clear cache for this scene
                scene.cache.destroy();
                
                // Restart scene
                scene.scene.start(scene.scene.key);
                
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Reset to safe game state
     */
    private async resetToSafeState(scene: Scene): Promise<void> {
        const sceneData = scene as any;
        
        // Reset player to spawn position if available
        if (sceneData.player && sceneData.respawnSystem) {
            try {
                sceneData.respawnSystem.requestRespawn();
            } catch (e) {
                this.logger.warn('Failed to respawn player', { error: e });
            }
        }

        // Clear any active tweens
        scene.tweens.killAll();

        // Reset camera
        if (scene.cameras.main && sceneData.player) {
            scene.cameras.main.startFollow(sceneData.player);
        }
    }

    /**
     * Reload the entire game
     */
    private reloadGame(): void {
        this.logger.error('Reloading game due to critical error');
        
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            z-index: 10000;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <h2>Game Error</h2>
            <p>An error occurred. The game will reload in 3 seconds...</p>
        `;
        document.body.appendChild(errorDiv);

        // Reload after delay
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }

    /**
     * Get error history
     */
    public getErrorHistory(): ReadonlyArray<GameError> {
        return [...this.errorHistory];
    }

    /**
     * Clear error history
     */
    public clearErrorHistory(): void {
        this.errorHistory = [];
    }
}

/**
 * Decorator for automatic error boundary wrapping
 */
export function ErrorBoundaryMethod(context?: ErrorContext) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const boundary = ErrorBoundary.getInstance();

        descriptor.value = function (this: any, ...args: any[]) {
            const methodContext = {
                ...context,
                system: target.constructor.name,
                action: propertyKey
            };

            return boundary.wrap(originalMethod, methodContext).apply(this, args);
        };

        return descriptor;
    };
}