import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';

export class PlayerInfoDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private jobText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    
    this.createTexts();
    
    this.container.setDepth(BOTTOM_UI_CONFIG.depth.content);
  }

  private createTexts(): void {
    const config = BOTTOM_UI_CONFIG.playerInfo;
    
    // Create player name text
    this.nameText = this.scene.add.text(
      0,
      0,
      'Player',
      {
        fontSize: config.nameSize,
        fontFamily: config.fontFamily,
        color: config.nameColor,
        fontStyle: 'bold',
      }
    );
    this.nameText.setOrigin(0, 0.5);
    
    // Create job/class text
    this.jobText = this.scene.add.text(
      0,
      20,
      'Soldier',
      {
        fontSize: config.jobSize,
        fontFamily: config.fontFamily,
        color: config.jobColor,
      }
    );
    this.jobText.setOrigin(0, 0.5);
    
    this.container.add([this.nameText, this.jobText]);
  }

  public updateInfo(name: string, job: string): void {
    this.nameText.setText(name);
    this.jobText.setText(job);
  }

  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public getWidth(): number {
    // Return the width of the longer text
    return Math.max(this.nameText.width, this.jobText.width);
  }

  public destroy(): void {
    this.container.destroy();
  }
}