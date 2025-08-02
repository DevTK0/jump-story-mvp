import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';

export interface KeyIndicatorConfig {
  key: string;
  label: string;
  description?: string;
}

interface IndicatorItem {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  keyBackground: Phaser.GameObjects.Rectangle;
  keyText: Phaser.GameObjects.Text;
  labelText: Phaser.GameObjects.Text;
  config: KeyIndicatorConfig;
}

export class KeyIndicatorManager {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private mainContainer!: Phaser.GameObjects.Container;
  private indicators: IndicatorItem[] = [];
  private logger: ModuleLogger = createLogger('KeyIndicatorManager');

  private isVisible: boolean = false;
  private fadeTimer?: Phaser.Time.TimerEvent;

  // Configuration
  private static readonly CONFIG = {
    margin: 20,
    topOffset: 120, // Position below boss bar area
    itemSpacing: 4, // Space between indicators
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
    
    this.mainContainer = this.scene.add.container(0, 0);
    this.mainContainer.setScrollFactor(0);
    this.mainContainer.setDepth(KeyIndicatorManager.CONFIG.depth);
    this.mainContainer.setVisible(false);
    this.mainContainer.setAlpha(0);
  }

  private createIndicator(config: KeyIndicatorConfig): IndicatorItem {
    const uiConfig = KeyIndicatorManager.CONFIG;
    
    const container = this.scene.add.container(0, 0);
    
    const keyLabel = config.key.toUpperCase();
    const isMultiChar = keyLabel.length > 1;
    const keyWidth = isMultiChar ? Math.max(uiConfig.keySize * 2, keyLabel.length * 8 + 12) : uiConfig.keySize;
    const fontSize = isMultiChar ? '12px' : uiConfig.keyFontSize;
    
    const keyBackground = this.scene.add.rectangle(
      0, 0,
      keyWidth,
      uiConfig.keySize,
      uiConfig.keyBackgroundColor,
      uiConfig.keyBackgroundAlpha
    );
    keyBackground.setStrokeStyle(1, uiConfig.borderColor, 0.5);
    
    const keyText = this.scene.add.text(0, 0, keyLabel, {
      fontSize: fontSize,
      fontFamily: uiConfig.fontFamily,
      color: uiConfig.keyTextColor,
      fontStyle: 'bold',
    });
    keyText.setOrigin(0.5, 0.5);
    
    const labelText = this.scene.add.text(0, 0, config.label, {
      fontSize: uiConfig.fontSize,
      fontFamily: uiConfig.fontFamily,
      color: uiConfig.textColor,
    });
    labelText.setOrigin(0, 0.5);
    
    const totalWidth = keyWidth + uiConfig.keyMargin + labelText.width + (uiConfig.padding * 2);
    const totalHeight = Math.max(uiConfig.keySize, labelText.height) + (uiConfig.padding * 2);
    
    const background = this.scene.add.rectangle(
      0, 0,
      totalWidth,
      totalHeight,
      uiConfig.backgroundColor,
      uiConfig.backgroundAlpha
    );
    background.setStrokeStyle(uiConfig.borderWidth, uiConfig.borderColor);
    
    const startX = -totalWidth / 2 + uiConfig.padding;
    
    keyBackground.setPosition(startX + keyWidth / 2, 0);
    keyText.setPosition(startX + keyWidth / 2, 0);
    labelText.setPosition(startX + keyWidth + uiConfig.keyMargin, 0);
    background.setPosition(0, 0);
    
    container.add([background, keyBackground, keyText, labelText]);
    
    return {
      container,
      background,
      keyBackground,
      keyText,
      labelText,
      config
    };
  }

  private updatePositions(): void {
    const config = KeyIndicatorManager.CONFIG;
    
    let totalHeight = 0;
    let maxWidth = 0;
    
    this.indicators.forEach((indicator, index) => {
      const width = indicator.background.width;
      const height = indicator.background.height;
      
      if (width > maxWidth) maxWidth = width;
      totalHeight += height;
      if (index > 0) totalHeight += config.itemSpacing;
    });
    
    const x = this.camera.width - config.margin - maxWidth / 2;
    const y = config.topOffset + totalHeight / 2;
    this.mainContainer.setPosition(x, y);
    
    let currentY = -totalHeight / 2;
    this.indicators.forEach((indicator) => {
      const width = indicator.background.width;
      const height = indicator.background.height;
      
      const xOffset = (maxWidth - width) / 2;
      indicator.container.setPosition(xOffset, currentY + height / 2);
      currentY += height + config.itemSpacing;
    });
  }

  public show(configs: KeyIndicatorConfig[], autoHide: boolean = true): void {
    this.clear();
    
    configs.forEach(config => {
      const indicator = this.createIndicator(config);
      this.indicators.push(indicator);
      this.mainContainer.add(indicator.container);
    });
    
    this.updatePositions();
    
    if (this.fadeTimer) {
      this.fadeTimer.destroy();
      this.fadeTimer = undefined;
    }
    
    this.mainContainer.setVisible(true);
    this.isVisible = true;
    
    this.scene.tweens.add({
      targets: this.mainContainer,
      alpha: 1,
      duration: KeyIndicatorManager.CONFIG.fadeInDuration,
      ease: 'Power2',
    });
    
    if (autoHide) {
      this.fadeTimer = this.scene.time.delayedCall(KeyIndicatorManager.CONFIG.autoHideDelay, () => {
        this.hide();
      });
    }
    
    this.logger.info(`Showing ${configs.length} key indicators`);
  }

  public hide(immediate: boolean = false): void {
    if (!this.isVisible && !immediate) return;
    
    const config = KeyIndicatorManager.CONFIG;
    
    if (this.fadeTimer) {
      this.fadeTimer.destroy();
      this.fadeTimer = undefined;
    }
    
    if (immediate) {
      this.mainContainer.setVisible(false);
      this.mainContainer.setAlpha(0);
      this.isVisible = false;
    } else {
      this.scene.tweens.add({
        targets: this.mainContainer,
        alpha: 0,
        duration: config.fadeOutDuration,
        ease: 'Power2',
        onComplete: () => {
          this.mainContainer.setVisible(false);
          this.isVisible = false;
        },
      });
    }
    
    this.logger.info('Hiding key indicators');
  }

  private clear(): void {
    this.indicators.forEach(indicator => {
      indicator.container.destroy();
    });
    this.indicators = [];
  }

  public destroy(): void {
    if (this.fadeTimer) {
      this.fadeTimer.destroy();
    }
    this.clear();
    this.mainContainer.destroy();
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }
}