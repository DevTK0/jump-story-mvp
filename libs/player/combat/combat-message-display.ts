import Phaser from 'phaser';

export interface CombatMessageConfig {
  fontSize: string;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  padding: { x: number; y: number };
  duration: number;
  fadeTime: number;
}

const DEFAULT_CONFIG: CombatMessageConfig = {
  fontSize: '16px',
  fontFamily: 'monospace',
  color: '#FF6B6B',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  padding: { x: 10, y: 5 },
  duration: 2000,
  fadeTime: 300,
};

/**
 * Displays combat-related messages to the player (errors, notifications, etc.)
 */
export class CombatMessageDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private config: CombatMessageConfig;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, config?: Partial<CombatMessageConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Create container to hold message elements
    this.container = scene.add.container(0, 0);
    this.container.setDepth(1000); // High depth to appear above everything
    this.container.setVisible(false);
    
    // Create background
    this.background = scene.add.rectangle(0, 0, 100, 30, 0x000000, 0.7);
    
    // Create text
    this.text = scene.add.text(0, 0, '', {
      fontSize: this.config.fontSize,
      fontFamily: this.config.fontFamily,
      color: this.config.color,
    });
    this.text.setOrigin(0.5);
    
    // Add to container
    this.container.add([this.background, this.text]);
    
    // Position at top center of screen
    this.updatePosition();
    
    // Listen for resize events
    scene.scale.on('resize', this.updatePosition, this);
  }

  /**
   * Show a message to the player
   */
  public showMessage(message: string): void {
    // Clear any existing timer
    if (this.hideTimer) {
      this.hideTimer.destroy();
    }
    
    // Update text
    this.text.setText(message);
    
    // Update background size
    const textBounds = this.text.getBounds();
    this.background.setSize(
      textBounds.width + this.config.padding.x * 2,
      textBounds.height + this.config.padding.y * 2
    );
    
    // Show container
    this.container.setVisible(true);
    this.container.setAlpha(1);
    
    // Set timer to hide
    this.hideTimer = this.scene.time.delayedCall(
      this.config.duration,
      () => this.hide()
    );
  }

  /**
   * Hide the message with fade out
   */
  private hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: this.config.fadeTime,
      onComplete: () => {
        this.container.setVisible(false);
      },
    });
  }

  /**
   * Update position based on screen size
   */
  private updatePosition(): void {
    const { width, height } = this.scene.scale;
    this.container.setPosition(width / 2, height * 0.15); // 15% from top
  }

  /**
   * Clean up
   */
  public destroy(): void {
    if (this.hideTimer) {
      this.hideTimer.destroy();
    }
    this.scene.scale.off('resize', this.updatePosition, this);
    this.container.destroy();
  }
}