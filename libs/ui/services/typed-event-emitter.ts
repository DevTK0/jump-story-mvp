import Phaser from 'phaser';

/**
 * Type-safe wrapper around Phaser's EventEmitter
 * Provides compile-time type checking for event names and payloads
 * 
 * @template T - Record mapping event names to their payload types
 */
export class TypedEventEmitter<T extends Record<string, any>> {
  private emitter = new Phaser.Events.EventEmitter();

  /**
   * Emit an event with type-safe payload
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.emitter.emit(event as string, data);
  }

  /**
   * Listen to an event with type-safe callback
   */
  on<K extends keyof T>(event: K, fn: (data: T[K]) => void, context?: any): void {
    this.emitter.on(event as string, fn, context);
  }

  /**
   * Listen to an event once with type-safe callback
   */
  once<K extends keyof T>(event: K, fn: (data: T[K]) => void, context?: any): void {
    this.emitter.once(event as string, fn, context);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof T>(event: K, fn?: (data: T[K]) => void, context?: any): void {
    this.emitter.off(event as string, fn, context);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.emitter.removeAllListeners(event as string);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Destroy the event emitter
   */
  destroy(): void {
    this.emitter.destroy();
  }
}