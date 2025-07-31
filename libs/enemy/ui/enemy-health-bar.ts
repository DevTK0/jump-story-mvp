import Phaser from 'phaser';
import { ENEMY_CONFIG } from '../config/enemy-config';

export class EnemyHealthBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private healthBar: Phaser.GameObjects.Graphics;
  private border: Phaser.GameObjects.Graphics;
  private hideTimer?: Phaser.Time.TimerEvent;

  private maxHp: number;
  private currentHp: number;
  private isVisible: boolean = false;
  private config: typeof ENEMY_CONFIG.healthBar;

  constructor(scene: Phaser.Scene, x: number, y: number, maxHp: number, config?: typeof ENEMY_CONFIG.healthBar) {
    this.scene = scene;
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.config = config || ENEMY_CONFIG.healthBar;

    // Create container to hold all health bar elements
    this.container = scene.add.container(x, y);
    this.container.setDepth(ENEMY_CONFIG.display.depth + 1); // Above enemies
    this.container.setAlpha(0); // Start invisible

    // Create graphics objects
    this.background = scene.add.graphics();
    this.healthBar = scene.add.graphics();
    this.border = scene.add.graphics();

    // Add to container
    this.container.add([this.background, this.healthBar, this.border]);

    this.drawHealthBar();
  }

  private drawHealthBar(): void {
    const config = this.config;
    const halfWidth = config.width / 2;
    const halfHeight = config.height / 2;

    // Clear all graphics
    this.background.clear();
    this.healthBar.clear();
    this.border.clear();

    // Draw background (black)
    this.background.fillStyle(config.backgroundColor, config.alpha);
    this.background.fillRoundedRect(
      -halfWidth,
      -halfHeight,
      config.width,
      config.height,
      config.cornerRadius
    );

    // Calculate health percentage and width
    const healthPercentage = Math.max(0, this.currentHp / this.maxHp);
    const healthWidth = config.width * healthPercentage;

    // Draw health bar (always red)
    if (healthWidth > 0) {
      this.healthBar.fillStyle(config.healthColor, config.alpha);
      this.healthBar.fillRoundedRect(
        -halfWidth,
        -halfHeight,
        healthWidth,
        config.height,
        config.cornerRadius
      );
    }

    // Draw border (white)
    this.border.lineStyle(config.borderWidth, config.borderColor, config.alpha);
    this.border.strokeRoundedRect(
      -halfWidth,
      -halfHeight,
      config.width,
      config.height,
      config.cornerRadius
    );
  }

  public updateHealth(newHp: number): void {
    this.currentHp = Math.max(0, Math.min(this.maxHp, newHp));

    // Only show health bar if enemy took damage and isn't dead
    if (newHp < this.maxHp && newHp > 0) {
      this.show();
    } else if (newHp <= 0) {
      this.hide();
    }

    this.drawHealthBar();
  }

  public updatePosition(x: number, y: number): void {
    this.container.setPosition(x, y + this.config.offsetY);
  }

  public show(): void {
    if (this.isVisible) {
      // Cancel existing hide timer if showing again
      if (this.hideTimer) {
        this.hideTimer.destroy();
        this.hideTimer = undefined;
      }
    } else {
      this.isVisible = true;
      // Fade in the health bar
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 200,
        ease: 'Power2.easeOut',
      });
    }

    // Set timer to hide after duration
    this.hideTimer = this.scene.time.delayedCall(this.config.showDuration, () => {
      this.hide();
    });
  }

  public hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;

    // Cancel hide timer if it exists
    if (this.hideTimer) {
      this.hideTimer.destroy();
      this.hideTimer = undefined;
    }

    // Fade out the health bar
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 300,
      ease: 'Power2.easeIn',
    });
  }

  public destroy(): void {
    if (this.hideTimer) {
      this.hideTimer.destroy();
      this.hideTimer = undefined;
    }

    this.container.destroy();
  }

  public setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }
}
