import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';

export interface KeyIndicatorConfig {
  key: string;
  label: string;
  description?: string;
}

export class KeyIndicator {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private keyBackground!: Phaser.GameObjects.Rectangle;
  private keyText!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;
  private logger: ModuleLogger = createLogger('KeyIndicator');

  private isVisible: boolean = false;
  private fadeTimer?: Phaser.Time.TimerEvent;

  // Configuration
  private static readonly CONFIG = {
    margin: 20,
    topOffset: 120, // Position below boss bar area
    padding: 8,
    keySize: 24,
    keyMargin: 6,
    backgroundColor: 0x000000,
    keyBackgroundColor: 0x222222,
    backgroundAlpha: 0.5, // More subtle
    keyBackgroundAlpha: 0.7,
    borderColor: 0x666666, // Dimmer border
    borderWidth: 1, // Thinner border
    cornerRadius: 3,
    depth: 999, // Just below tooltips
    fontSize: '14px', // Smaller text
    keyFontSize: '14px', // Smaller key text
    fontFamily: 'Arial',
    textColor: '#cccccc', // Dimmer text
    keyTextColor: '#ffffff',
    fadeInDuration: 300,
    fadeOutDuration: 500,
    autoHideDelay: 5000, // Auto hide after 5 seconds
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.getCamera('ui') ?? scene.cameras.main;
    
    this.createUI();
    this.hide(true); // Start hidden without animation
  }

  private createUI(): void {
    const config = KeyIndicator.CONFIG;
    
    // Create container - will be positioned in show()
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0); // Fixed to viewport
    this.container.setDepth(config.depth);
    
    // Create key background (the key button visual)
    this.keyBackground = this.scene.add.rectangle(
      0, 0,
      config.keySize,
      config.keySize,
      config.keyBackgroundColor,
      config.keyBackgroundAlpha
    );
    this.keyBackground.setStrokeStyle(1, config.borderColor, 0.5); // Subtle border
    
    // Create key text
    this.keyText = this.scene.add.text(0, 0, '', {
      fontSize: config.keyFontSize,
      fontFamily: config.fontFamily,
      color: config.keyTextColor,
      fontStyle: 'bold',
    });
    this.keyText.setOrigin(0.5, 0.5);
    
    // Create label text
    this.labelText = this.scene.add.text(0, 0, '', {
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      color: config.textColor,
    });
    this.labelText.setOrigin(0, 0.5);
    
    // Create background (will be sized dynamically)
    this.background = this.scene.add.rectangle(
      0, 0, 100, 40,
      config.backgroundColor,
      config.backgroundAlpha
    );
    this.background.setStrokeStyle(config.borderWidth, config.borderColor);
    
    // Add to container (background first, then other elements)
    this.container.add([
      this.background,
      this.keyBackground,
      this.keyText,
      this.labelText
    ]);
  }

  public show(config: KeyIndicatorConfig, autoHide: boolean = true): void {
    const uiConfig = KeyIndicator.CONFIG;
    
    // Update texts
    this.keyText.setText(config.key.toUpperCase());
    this.labelText.setText(config.label);
    
    // Calculate dimensions
    const totalWidth = uiConfig.keySize + uiConfig.keyMargin + this.labelText.width + (uiConfig.padding * 2);
    const totalHeight = Math.max(uiConfig.keySize, this.labelText.height) + (uiConfig.padding * 2);
    
    // Update background size
    this.background.setSize(totalWidth, totalHeight);
    
    // Position elements relative to container center
    const startX = -totalWidth / 2 + uiConfig.padding;
    
    this.keyBackground.setPosition(startX + uiConfig.keySize / 2, 0);
    this.keyText.setPosition(startX + uiConfig.keySize / 2, 0);
    this.labelText.setPosition(startX + uiConfig.keySize + uiConfig.keyMargin, 0);
    this.background.setPosition(0, 0);
    
    // Position container in top right, below boss bar area
    const x = this.camera.width - uiConfig.margin - totalWidth / 2;
    const y = uiConfig.topOffset + totalHeight / 2;
    this.container.setPosition(x, y);
    
    // Cancel any existing fade timer
    if (this.fadeTimer) {
      this.fadeTimer.destroy();
      this.fadeTimer = undefined;
    }
    
    // Show with fade in
    this.container.setVisible(true);
    this.isVisible = true;
    
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: uiConfig.fadeInDuration,
      ease: 'Power2',
    });
    
    // Set up auto hide if requested
    if (autoHide) {
      this.fadeTimer = this.scene.time.delayedCall(uiConfig.autoHideDelay, () => {
        this.hide();
      });
    }
    
    this.logger.info(`Showing key indicator: ${config.key} - ${config.label}`);
  }

  public hide(immediate: boolean = false): void {
    if (!this.isVisible && !immediate) return;
    
    const config = KeyIndicator.CONFIG;
    
    // Cancel any existing fade timer
    if (this.fadeTimer) {
      this.fadeTimer.destroy();
      this.fadeTimer = undefined;
    }
    
    if (immediate) {
      this.container.setVisible(false);
      this.container.setAlpha(0);
      this.isVisible = false;
    } else {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: config.fadeOutDuration,
        ease: 'Power2',
        onComplete: () => {
          this.container.setVisible(false);
          this.isVisible = false;
        },
      });
    }
    
    this.logger.info('Hiding key indicator');
  }

  public destroy(): void {
    if (this.fadeTimer) {
      this.fadeTimer.destroy();
    }
    this.container.destroy();
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }
}