import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';

export class CompactStatBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private fillBar!: Phaser.GameObjects.Graphics;
  private labelText!: Phaser.GameObjects.Text;
  private valueText!: Phaser.GameObjects.Text;
  
  private barType: 'hp' | 'mp' | 'exp';

  constructor(scene: Phaser.Scene, type: 'hp' | 'mp' | 'exp') {
    this.scene = scene;
    this.barType = type;
    this.container = this.scene.add.container(0, 0);
    
    this.createBar();
    this.createTexts();
    
    this.container.setDepth(BOTTOM_UI_CONFIG.depth.content);
  }

  private createBar(): void {
    const config = BOTTOM_UI_CONFIG.statBars;
    const barConfig = config[this.barType];
    
    // Create background
    this.background = this.scene.add.graphics();
    this.background.fillStyle(barConfig.backgroundColor, 1);
    this.background.fillRect(0, 0, config.width, config.height);
    this.background.lineStyle(config.borderWidth, config.borderColor);
    this.background.strokeRect(0, 0, config.width, config.height);
    
    // Create fill bar
    this.fillBar = this.scene.add.graphics();
    
    this.container.add([this.background, this.fillBar]);
  }

  private createTexts(): void {
    const config = BOTTOM_UI_CONFIG.statBars;
    const barConfig = config[this.barType];
    
    // Create label (HP/MP/EXP) above the bar, left-aligned
    this.labelText = this.scene.add.text(
      0,
      -20, // Position above the bar with more spacing
      barConfig.label,
      {
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        color: config.fontColor,
        fontStyle: 'bold',
        resolution: 2, // Higher resolution for sharper text
      }
    );
    this.labelText.setOrigin(0, 0.5);
    
    // Create value text (current/max) above the bar, right side
    this.valueText = this.scene.add.text(
      config.width,
      -20, // Same height as label with more spacing
      '0/0',
      {
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        color: config.fontColor,
        resolution: 2, // Higher resolution for sharper text
      }
    );
    this.valueText.setOrigin(1, 0.5); // Right-aligned
    
    this.container.add([this.labelText, this.valueText]);
  }

  public updateValues(current: number, max: number): void {
    
    // Update fill bar
    const config = BOTTOM_UI_CONFIG.statBars;
    const barConfig = config[this.barType];
    const percentage = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    
    this.fillBar.clear();
    this.fillBar.fillStyle(barConfig.fillColor, 1);
    this.fillBar.fillRect(
      config.borderWidth,
      config.borderWidth,
      (config.width - config.borderWidth * 2) * percentage,
      config.height - config.borderWidth * 2
    );
    
    // Update text
    this.valueText.setText(`${Math.floor(current)}/${Math.floor(max)}`);
  }

  public setPosition(x: number, y: number): void {
    // Round to integer pixels to prevent blurry text
    this.container.setPosition(Math.round(x), Math.round(y));
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.container.destroy();
  }
}