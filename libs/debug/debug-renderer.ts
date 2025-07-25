import type { IDebuggable } from './debug-interfaces';
import { DebugState } from './debug-state';

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
