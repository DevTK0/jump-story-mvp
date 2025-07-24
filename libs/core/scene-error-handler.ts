import { Scene } from 'phaser';
import type { ErrorContext } from './error-boundary';
import { ErrorBoundary, GameError, ErrorSeverity } from './error-boundary';

/**
 * Phaser Scene Error Handler
 * Automatically wraps scene lifecycle methods with error boundaries
 */
export class SceneErrorHandler {
    private errorBoundary: ErrorBoundary;

    constructor() {
        this.errorBoundary = ErrorBoundary.getInstance();
    }

    /**
     * Protect a Phaser scene with error boundaries
     */
    public protectScene(scene: Scene): void {
        const context: ErrorContext = {
            scene,
            system: 'scene'
        };

        // Wrap lifecycle methods
        this.wrapLifecycleMethods(scene, context);

        // Wrap update methods
        this.wrapUpdateMethods(scene, context);

        // Wrap event handlers
        this.wrapEventHandlers(scene, context);

        // Add error logging
        this.addErrorLogging(scene);
    }

    /**
     * Wrap scene lifecycle methods
     */
    private wrapLifecycleMethods(scene: Scene, context: ErrorContext): void {
        const lifecycleMethods = ['init', 'preload', 'create'] as const;

        for (const method of lifecycleMethods) {
            const original = (scene as any)[method];
            if (typeof original === 'function') {
                (scene as any)[method] = this.errorBoundary.wrap(
                    original.bind(scene),
                    { ...context, action: method }
                );
            }
        }
    }

    /**
     * Wrap update methods
     */
    private wrapUpdateMethods(scene: Scene, context: ErrorContext): void {
        const updateMethods = ['update', 'preUpdate', 'postUpdate'] as const;

        for (const method of updateMethods) {
            const original = (scene as any)[method];
            if (typeof original === 'function') {
                (scene as any)[method] = this.createRateLimitedWrapper(
                    original.bind(scene),
                    { ...context, action: method }
                );
            }
        }
    }

    /**
     * Create a rate-limited error wrapper for frequently called methods
     */
    private createRateLimitedWrapper(
        fn: Function,
        context: ErrorContext
    ): Function {
        let lastErrorTime = 0;
        const ERROR_COOLDOWN = 1000; // 1 second cooldown between same errors

        return (...args: any[]) => {
            try {
                return fn(...args);
            } catch (error) {
                const now = Date.now();
                if (now - lastErrorTime > ERROR_COOLDOWN) {
                    lastErrorTime = now;
                    this.errorBoundary.handleError(error as Error, context);
                }
                // Don't throw in update loops to prevent game freeze
            }
        };
    }

    /**
     * Wrap common event handlers
     */
    private wrapEventHandlers(scene: Scene, context: ErrorContext): void {
        // Wrap input events
        const inputEvents = ['pointerdown', 'pointerup', 'pointermove'];
        
        for (const eventName of inputEvents) {
            const originalEmit = scene.input.emit.bind(scene.input);
            
            scene.input.on(eventName, (...args: any[]) => {
                try {
                    originalEmit(eventName, ...args);
                } catch (error) {
                    this.errorBoundary.handleError(error as Error, {
                        ...context,
                        action: `input-${eventName}`
                    });
                }
            });
        }

        // Wrap keyboard events if keyboard plugin exists
        if (scene.input.keyboard) {
            const originalAddKey = scene.input.keyboard.addKey.bind(scene.input.keyboard);
            const errorBoundary = this.errorBoundary;
            
            scene.input.keyboard.addKey = function(key: any, ...args: any[]) {
                const keyObj = originalAddKey(key, ...args);
                
                // Wrap key event handlers
                const wrapKeyHandler = (handler: Function) => {
                    return (...handlerArgs: any[]) => {
                        try {
                            return handler(...handlerArgs);
                        } catch (error) {
                            errorBoundary.handleError(error as Error, {
                                ...context,
                                action: `keyboard-${key}`
                            });
                        }
                    };
                };

                // Override on method to wrap handlers
                const originalOn = keyObj.on.bind(keyObj);
                keyObj.on = function(event: string, handler: Function, ...onArgs: any[]) {
                    return originalOn(event, wrapKeyHandler(handler), ...onArgs);
                };

                return keyObj;
            };
        }
    }

    /**
     * Add error logging for scene
     */
    private addErrorLogging(scene: Scene): void {
        // Register error handler to log errors to console only
        this.errorBoundary.registerErrorHandler(`scene-${scene.scene.key}`, (error: GameError) => {
            // Log errors to console with appropriate level
            const logMessage = `[Scene: ${scene.scene.key}] ${error.message}`;
            
            switch (error.severity) {
                case ErrorSeverity.LOW:
                    console.debug(logMessage, error);
                    break;
                case ErrorSeverity.MEDIUM:
                    console.warn(logMessage, error);
                    break;
                case ErrorSeverity.HIGH:
                case ErrorSeverity.CRITICAL:
                    console.error(logMessage, error);
                    break;
            }
        });
    }
}

/**
 * Helper function to protect a scene
 */
export function protectScene(scene: Scene): void {
    const handler = new SceneErrorHandler();
    handler.protectScene(scene);
}