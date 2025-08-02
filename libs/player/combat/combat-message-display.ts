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
  private camera: Phaser.Cameras.Scene2D.Camera;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private text: Phaser.GameObjects.Text;
  private config: CombatMessageConfig;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, config?: Partial<CombatMessageConfig>) {
    this.scene = scene;
    this.camera = scene.cameras.getCamera('ui') ?? scene.cameras.main;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);
    this.container.setVisible(false);
    
    this.background = scene.add.rectangle(0, 0, 100, 30, 0x000000, 0.7);
    
    this.text = scene.add.text(0, 0, '', {
      fontSize: this.config.fontSize,
      fontFamily: this.config.fontFamily,
      color: this.config.color,
    });
    this.text.setOrigin(0.5);
    
    this.container.add([this.background, this.text]);
    
    this.updatePosition();
    
    scene.scale.on('resize', this.updatePosition, this);
  }

  public showMessage(message: string): void {
    if (this.hideTimer) {
      this.hideTimer.destroy();
    }
    
    this.text.setText(message);
    
    const textBounds = this.text.getBounds();
    this.background.setSize(
      textBounds.width + this.config.padding.x * 2,
      textBounds.height + this.config.padding.y * 2
    );
    
    this.container.setVisible(true);
    this.container.setAlpha(1);
    
    this.hideTimer = this.scene.time.delayedCall(
      this.config.duration,
      () => this.hide()
    );
  }

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

  private updatePosition(): void {
    const width = this.camera.width;
    const height = this.camera.height;
    this.container.setPosition(width / 2, height * 0.15);
  }

  public destroy(): void {
    if (this.hideTimer) {
      this.hideTimer.destroy();
    }
    this.scene.scale.off('resize', this.updatePosition, this);
    this.container.destroy();
  }
}