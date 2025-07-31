import Phaser from 'phaser';

export class BossHealthBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private healthBar: Phaser.GameObjects.Graphics;
  private border: Phaser.GameObjects.Graphics;
  private bossNameText: Phaser.GameObjects.Text;

  private maxHp: number;
  private currentHp: number;
  private bossName: string;
  private isVisible: boolean = false;

  // Configuration for full-width boss health bar
  private static readonly CONFIG = {
    height: 40,
    marginX: 20, // Left and right margins
    marginY: 20, // Top margin
    backgroundColor: 0x000000,
    healthColor: 0xff0000,
    borderColor: 0xffffff,
    borderWidth: 2,
    alpha: 0.9,
    cornerRadius: 4,
    nameStyle: {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 2,
    },
    depth: 1000, // Very high depth to ensure it's on top
  };

  constructor(scene: Phaser.Scene, bossName: string, maxHp: number) {
    this.scene = scene;
    this.bossName = bossName;
    this.maxHp = maxHp;
    this.currentHp = maxHp;

    this.createHealthBar();
    this.updatePosition();
    
    // Listen for camera changes to update position
    this.scene.cameras.main.on('followupdate', this.updatePosition, this);
  }

  private createHealthBar(): void {
    const config = BossHealthBar.CONFIG;
    
    // Create container
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(config.depth);
    this.container.setAlpha(0); // Start invisible

    // Create graphics objects
    this.background = this.scene.add.graphics();
    this.healthBar = this.scene.add.graphics();
    this.border = this.scene.add.graphics();

    // Create boss name text
    this.bossNameText = this.scene.add.text(0, 0, this.bossName, config.nameStyle);
    this.bossNameText.setOrigin(0.5, 0.5);

    // Add to container
    this.container.add([this.background, this.healthBar, this.border, this.bossNameText]);

    this.drawHealthBar();
  }

  private drawHealthBar(): void {
    const config = BossHealthBar.CONFIG;
    const camera = this.scene.cameras.main;
    const width = camera.width - (config.marginX * 2);
    const height = config.height;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Clear all graphics
    this.background.clear();
    this.healthBar.clear();
    this.border.clear();

    // Draw background (black)
    this.background.fillStyle(config.backgroundColor, config.alpha);
    this.background.fillRoundedRect(
      -halfWidth,
      -halfHeight,
      width,
      height,
      config.cornerRadius
    );

    // Calculate health percentage and width
    const healthPercentage = Math.max(0, this.currentHp / this.maxHp);
    const healthWidth = width * healthPercentage;

    // Draw health bar (red)
    if (healthWidth > 0) {
      this.healthBar.fillStyle(config.healthColor, config.alpha);
      this.healthBar.fillRoundedRect(
        -halfWidth,
        -halfHeight,
        healthWidth,
        height,
        config.cornerRadius
      );
    }

    // Draw border (white)
    this.border.lineStyle(config.borderWidth, config.borderColor, config.alpha);
    this.border.strokeRoundedRect(
      -halfWidth,
      -halfHeight,
      width,
      height,
      config.cornerRadius
    );

    // Position boss name text at the center of the health bar
    this.bossNameText.setPosition(0, 0);
  }

  private updatePosition(): void {
    if (!this.container) return;
    
    const config = BossHealthBar.CONFIG;
    const camera = this.scene.cameras.main;
    
    // Position at top of screen, following camera
    const x = camera.centerX;
    const y = camera.y + config.marginY + (config.height / 2);
    
    this.container.setPosition(x, y);
  }

  public updateHealth(newHp: number): void {
    this.currentHp = Math.max(0, Math.min(this.maxHp, newHp));

    // Show health bar when boss takes damage
    if (newHp < this.maxHp && newHp > 0) {
      this.show();
    } else if (newHp <= 0) {
      this.hide();
    }

    this.drawHealthBar();
  }

  public show(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.updatePosition(); // Ensure correct position
    
    // Fade in the health bar
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Power2.easeOut',
    });
  }

  public hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;

    // Fade out the health bar
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 500,
      ease: 'Power2.easeIn',
    });
  }

  public destroy(): void {
    // Remove camera listener
    this.scene.cameras.main.off('followupdate', this.updatePosition, this);
    
    if (this.container) {
      this.container.destroy();
    }
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }

  public updateBossName(newName: string): void {
    this.bossName = newName;
    this.bossNameText.setText(newName);
  }
}