import Phaser from 'phaser';
import { BOTTOM_UI_CONFIG } from '../bottom-ui-config';

export class PlayerInfoDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private jobText: Phaser.GameObjects.Text;
  private combatIndicator: Phaser.GameObjects.Text;

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
    
    // Create combat indicator
    this.combatIndicator = this.scene.add.text(
      0,
      -20,
      'IN COMBAT',
      {
        fontSize: '12px',
        fontFamily: config.fontFamily,
        color: '#ff6666',
        fontStyle: 'bold',
        backgroundColor: '#440000',
        padding: { x: 4, y: 2 },
      }
    );
    this.combatIndicator.setOrigin(0, 0.5);
    this.combatIndicator.setVisible(false); // Hidden by default
    
    this.container.add([this.nameText, this.jobText, this.combatIndicator]);
  }

  public updateInfo(name: string, job: string): void {
    this.nameText.setText(name);
    this.jobText.setText(job);
  }

  public setCombatState(inCombat: boolean): void {
    this.combatIndicator.setVisible(inCombat);
    
    if (inCombat) {
      // Add pulsing effect when in combat
      this.scene.tweens.add({
        targets: this.combatIndicator,
        alpha: { from: 0.7, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    } else {
      // Stop any active tweens
      this.scene.tweens.killTweensOf(this.combatIndicator);
      this.combatIndicator.setAlpha(1);
    }
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