import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';

export class PlayerLevelSquare {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    
    this.createBackground();
    this.createTexts();
    
    this.container.setDepth(BOTTOM_UI_CONFIG.depth.content);
  }

  private createBackground(): void {
    const config = BOTTOM_UI_CONFIG.levelDisplay;
    
    this.background = this.scene.add.graphics();
    
    // Draw background with gradient effect
    this.background.fillStyle(config.backgroundColor, 1);
    this.background.fillRect(0, 0, config.width, config.height);
    
    // Draw border
    this.background.lineStyle(config.borderWidth, config.borderColor);
    this.background.strokeRect(0, 0, config.width, config.height);
    
    this.container.add(this.background);
  }

  private createTexts(): void {
    const config = BOTTOM_UI_CONFIG.levelDisplay;
    
    // Create combined "LV. X" text
    this.levelText = this.scene.add.text(
      config.width / 2,
      config.height / 2,
      'LV. 1',
      {
        fontSize: '20px', // Can be larger now with more width
        fontFamily: config.fontFamily,
        color: config.fontColor,
        fontStyle: 'bold',
      }
    );
    this.levelText.setOrigin(0.5, 0.5);
    
    this.container.add(this.levelText);
  }

  public updateLevel(level: number): void {
    this.levelText.setText(`LV. ${level}`);
  }

  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.container.destroy();
  }
}