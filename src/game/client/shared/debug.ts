// Debug interface for components that can render debug information
export interface IDebuggable {
    renderDebug?(graphics: Phaser.GameObjects.Graphics): void;
    getDebugInfo?(): Record<string, any>;
    isDebugEnabled?(): boolean;
    cleanupDebugResources?(): void;
}

// Debug configuration constants
export const DEBUG_CONFIG = {
    trajectory: {
        maxPoints: 60, // 1 second at 60fps
        sampleRate: 2, // Sample every 2 frames for performance
        shadowSkipRate: 4, // Only show every 4th point to avoid too many sprites
        shadowAlphaRange: [0.3, 0.7] as const, // Range from 0.3 to 0.7
        shadowTint: 0x666666, // Gray tint for shadow effect
    },
    colors: {
        hitbox: 0x00ff00, // Green
        attackHitbox: 0xff8800, // Orange
        velocity: 0xffff00, // Yellow
        collision: 0x4444ff, // Blue
        climbeable: 0x00ff00, // Green
        stateText: "#00ff00", // Green text
    },
    ui: {
        stateTextSize: 16,
        stateTextPosition: [10, 10] as const,
        velocityScale: 0.5,
        collisionCheckRadius: 400,
        hitboxAlpha: 0.5,
        arrowLength: 8,
        arrowAngle: Math.PI / 6,
        centerPointRadius: 3,
    },
    input: {
        toggleKey: Phaser.Input.Keyboard.KeyCodes.D,
    },
} as const;

// Shadow effect state management (separate from debug mode)
export class ShadowState {
    private static instance: ShadowState;
    private _enabled = false;

    static getInstance(): ShadowState {
        if (!ShadowState.instance) {
            ShadowState.instance = new ShadowState();
        }
        return ShadowState.instance;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
        console.log(`Shadow effect ${value ? "enabled" : "disabled"}`);
    }

    toggle(): void {
        this.enabled = !this.enabled;
    }
}

// Debug state management
export class DebugState {
    private static instance: DebugState;
    private _enabled = false;

    static getInstance(): DebugState {
        if (!DebugState.instance) {
            DebugState.instance = new DebugState();
        }
        return DebugState.instance;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        const previousState = this._enabled;
        this._enabled = value;
        console.log(`Debug mode ${value ? "enabled" : "disabled"}`);
        
        // Emit debug events
        DebugEventBus.getInstance().emitStateChanged(value, previousState);
    }

    toggle(): void {
        this.enabled = !this.enabled;
    }
}

// Trajectory point interface
export interface TrajectoryPoint {
    x: number;
    y: number;
    timestamp: number;
    texture: string;
    frame: string | number;
    flipX: boolean;
    scaleX: number;
    scaleY: number;
}

/**
 * Base class for debug renderers that eliminates duplicate debug state checks
 */
export abstract class BaseDebugRenderer implements IDebuggable {
  /**
   * Template method that checks debug state before rendering
   */
  renderDebug(graphics: Phaser.GameObjects.Graphics): void {
    if (!DebugState.getInstance().enabled) return;
    this.performDebugRender(graphics);
  }

  /**
   * Template method that checks debug state before providing debug info
   */
  getDebugInfo(): Record<string, any> {
    if (!DebugState.getInstance().enabled) return {};
    return this.provideDebugInfo();
  }

  /**
   * Check if debug is enabled
   */
  isDebugEnabled(): boolean {
    return DebugState.getInstance().enabled;
  }

  /**
   * Subclasses implement actual rendering logic
   */
  protected abstract performDebugRender(graphics: Phaser.GameObjects.Graphics): void;

  /**
   * Subclasses implement actual debug info logic
   */
  protected abstract provideDebugInfo(): Record<string, any>;
}

/**
 * Event-based debug state management
 * Replaces polling-based debug toggle with event system
 */
export enum DebugEvent {
  STATE_CHANGED = 'debug:stateChanged',
  ENABLED = 'debug:enabled',
  DISABLED = 'debug:disabled',
}

export interface DebugStateChangedEvent {
  enabled: boolean;
  previousState: boolean;
}

export class DebugEventBus extends Phaser.Events.EventEmitter {
  private static instance: DebugEventBus;

  static getInstance(): DebugEventBus {
    if (!DebugEventBus.instance) {
      DebugEventBus.instance = new DebugEventBus();
    }
    return DebugEventBus.instance;
  }

  emitStateChanged(enabled: boolean, previousState: boolean): void {
    const event: DebugStateChangedEvent = { enabled, previousState };
    this.emit(DebugEvent.STATE_CHANGED, event);
    this.emit(enabled ? DebugEvent.ENABLED : DebugEvent.DISABLED);
  }
}

/**
 * Formats debug information for display
 * Extracted from DebugSystem to follow Single Responsibility Principle
 */
export class DebugInfoFormatter {
  /**
   * Format debug info object into readable text
   */
  static format(debugInfo: Record<string, any>): string {
    const lines: string[] = ['Debug Info:'];
    
    Object.entries(debugInfo).forEach(([key, value]) => {
      lines.push(this.formatEntry(key, value));
    });
    
    return lines.join('\n');
  }

  /**
   * Format a single debug entry
   */
  private static formatEntry(key: string, value: any, indent: number = 0): string {
    const indentation = '  '.repeat(indent);
    
    if (value === null || value === undefined) {
      return `${indentation}${key}: null`;
    }
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `${indentation}${key}: [${value.join(', ')}]`;
      }
      
      // Handle nested objects
      const nestedLines: string[] = [`${indentation}${key}:`];
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        nestedLines.push(this.formatEntry(nestedKey, nestedValue, indent + 1));
      });
      return nestedLines.join('\n');
    }
    
    // Handle primitives
    return `${indentation}${key}: ${value}`;
  }

  /**
   * Format velocity as a readable string
   */
  static formatVelocity(x: number, y: number): string {
    return `(${x}, ${y})`;
  }

  /**
   * Format position as a readable string
   */
  static formatPosition(x: number, y: number): string {
    return `(${Math.round(x)}, ${Math.round(y)})`;
  }

  /**
   * Format boolean as yes/no
   */
  static formatBoolean(value: boolean): string {
    return value ? 'Yes' : 'No';
  }
}
