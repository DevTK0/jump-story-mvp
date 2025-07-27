import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';

export class PlayerLevelSquare {
  private scene: Phaser.Scene;
  private levelText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    this.createTexts();
  }

  private createTexts(): void {
    const config = BOTTOM_UI_CONFIG.levelDisplay;
    
    // Create combined "LV. X" text
    this.levelText = this.scene.add.text(
      0,
      0,
      'LV. 1',
      {
        fontSize: '20px', // Can be larger now with more width
        fontFamily: config.fontFamily,
        color: config.fontColor,
        fontStyle: 'bold',
      }
    );
    this.levelText.setOrigin(0, 0.5);
  }

  public updateLevel(level: number): void {
    this.levelText.setText(`LV. ${level}`);
  }

  public setPosition(x: number, y: number): void {
    this.levelText.setPosition(x, y);
  }

  public getText(): Phaser.GameObjects.Text {
    return this.levelText;
  }

  public destroy(): void {
    this.levelText.destroy();
  }
}