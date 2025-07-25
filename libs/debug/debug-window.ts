import type { IDebuggable } from './debug-interfaces';

export interface DebugWindowConfig {
  scene: Phaser.Scene;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  maxLines?: number;
}

/**
 * Scrollable debug window component that displays debug information
 * from multiple debuggable components in a unified interface
 */
export class DebugWindow {
  private scene: Phaser.Scene;
  private config: Required<DebugWindowConfig>;

  // UI Components
  private container?: Phaser.GameObjects.Container;
  private background?: Phaser.GameObjects.Rectangle;
  private textObjects: Phaser.GameObjects.Text[] = [];
  private scrollIndicator?: Phaser.GameObjects.Text;

  // State
  private scrollOffset = 0;
  private isVisible = false;

  constructor(config: DebugWindowConfig) {
    this.scene = config.scene;
    this.config = {
      scene: config.scene,
      width: config.width ?? 300,
      height: config.height ?? 300,
      x: config.x ?? 10,
      y: config.y ?? 10,
      maxLines: config.maxLines ?? 15,
    };
  }

  /**
   * Create and show the debug window
   */
  public show(): void {
    if (this.isVisible) return;

    this.createUI();
    this.setupScrollControls();
    this.isVisible = true;
  }

  /**
   * Hide and cleanup the debug window
   */
  public hide(): void {
    if (!this.isVisible) return;

    this.cleanup();
    this.isVisible = false;
  }

  /**
   * Update the debug window with new information from debuggable components
   */
  public updateDisplay(debuggableComponents: IDebuggable[]): void {
    if (!this.isVisible || !this.container) return;

    // Collect debug info from all components
    const debugInfo = debuggableComponents
      .map((component) => component.getDebugInfo?.() || {})
      .reduce((acc, info) => ({ ...acc, ...info }), {});

    // Convert to array of formatted lines
    const lines = Object.entries(debugInfo).map(([key, value]) => {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `${key}: ${valueStr}`;
    });

    // Update visible text lines with scrolling
    this.updateVisibleLines(lines);

    // Clamp scroll offset if we scrolled too far
    this.clampScrollOffset(lines.length);
  }

  /**
   * Check if the debug window is currently visible
   */
  public get visible(): boolean {
    return this.isVisible;
  }

  /**
   * Scroll the debug window up by the specified number of lines
   */
  public scrollUp(lines: number = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
  }

  /**
   * Scroll the debug window down by the specified number of lines
   */
  public scrollDown(lines: number = 1): void {
    // We'll clamp this in updateDisplay when we know the total line count
    this.scrollOffset += lines;
  }

  /**
   * Reset scroll to the top of the debug window
   */
  public scrollToTop(): void {
    this.scrollOffset = 0;
  }

  /**
   * Get the current scroll position
   */
  public getScrollOffset(): number {
    return this.scrollOffset;
  }

  /**
   * Create the UI components for the debug window
   */
  private createUI(): void {
    // Create container for the debug window
    this.container = this.scene.add.container(this.config.x, this.config.y);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);

    // Create background
    this.background = this.scene.add.rectangle(
      0,
      0,
      this.config.width,
      this.config.height,
      0x000000,
      0.8
    );
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(2, 0x00ff00, 0.8);
    this.container.add(this.background);

    // Create text objects for each line
    const lineHeight = 20;
    for (let i = 0; i < this.config.maxLines; i++) {
      const text = this.scene.add.text(10, 10 + i * lineHeight, '', {
        fontSize: '14px',
        color: '#00ff00',
        fontFamily: 'monospace',
      });
      text.setOrigin(0, 0);
      this.textObjects.push(text);
      this.container.add(text);
    }

    // Add scroll indicator
    this.scrollIndicator = this.scene.add.text(
      this.config.width - 80,
      this.config.height - 15,
      'Mouse: Scroll',
      {
        fontSize: '10px',
        color: '#888888',
        fontFamily: 'monospace',
      }
    );
    this.scrollIndicator.setOrigin(0, 0);
    this.container.add(this.scrollIndicator);
  }

  /**
   * Set up mouse wheel scrolling for the debug window
   */
  private setupScrollControls(): void {
    this.scene.input.on(
      'wheel',
      (pointer: any, _gameObjects: any, _deltaX: number, deltaY: number, _deltaZ: number) => {
        if (!this.isVisible) return;

        // Check if mouse is over the debug window
        if (this.isMouseOverWindow(pointer)) {
          const scrollDirection = Math.sign(deltaY);

          if (scrollDirection > 0) {
            this.scrollDown(1);
          } else if (scrollDirection < 0) {
            this.scrollUp(1);
          }
        }
      }
    );
  }

  /**
   * Check if the mouse pointer is over the debug window
   */
  private isMouseOverWindow(pointer: any): boolean {
    if (!this.container || !this.background) return false;

    // Get debug window bounds (container position + background bounds)
    const containerBounds = this.container.getBounds();

    return (
      pointer.x >= containerBounds.x &&
      pointer.x <= containerBounds.x + containerBounds.width &&
      pointer.y >= containerBounds.y &&
      pointer.y <= containerBounds.y + containerBounds.height
    );
  }

  /**
   * Update the visible text lines based on current scroll position
   */
  private updateVisibleLines(lines: string[]): void {
    for (let i = 0; i < this.config.maxLines; i++) {
      const lineIndex = i + this.scrollOffset;
      const textObject = this.textObjects[i];

      if (lineIndex < lines.length) {
        textObject.setText(lines[lineIndex]);
        textObject.setVisible(true);
      } else {
        textObject.setText('');
        textObject.setVisible(false);
      }
    }
  }

  /**
   * Clamp the scroll offset to valid bounds
   */
  private clampScrollOffset(totalLines: number): void {
    const maxScroll = Math.max(0, totalLines - this.config.maxLines);
    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);
    this.scrollOffset = Math.max(0, this.scrollOffset);
  }

  /**
   * Cleanup all UI components
   */
  private cleanup(): void {
    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }

    this.background = undefined;
    this.textObjects = [];
    this.scrollIndicator = undefined;
    this.scrollOffset = 0;
  }

  /**
   * Destroy the debug window and clean up all resources
   */
  public destroy(): void {
    this.hide();
  }
}
