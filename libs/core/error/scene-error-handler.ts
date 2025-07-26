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
      system: 'scene',
    };

    // Wrap lifecycle methods
    this.wrapLifecycleMethods(scene, context);

    // Wrap update methods
    this.wrapUpdateMethods(scene, context);

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
        (scene as any)[method] = this.errorBoundary.wrap(original.bind(scene), {
          ...context,
          action: method,
        });
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
        (scene as any)[method] = this.createRateLimitedWrapper(original.bind(scene), {
          ...context,
          action: method,
        });
      }
    }
  }

  /**
   * Create a rate-limited error wrapper for frequently called methods
   */
  private createRateLimitedWrapper(fn: Function, context: ErrorContext): Function {
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
