import Phaser from 'phaser';

export class BossHealthBar {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private healthBar!: Phaser.GameObjects.Graphics;
  private border!: Phaser.GameObjects.Graphics;
  private bossNameText!: Phaser.GameObjects.Text;
  private timerContainer!: Phaser.GameObjects.Container;
  private timerBackground!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;

  private maxHp: number;
  private currentHp: number;
  private bossName: string;
  private spawnTime: number;
  private isVisible: boolean = false;
  private timerUpdateInterval?: number;

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
    timer: {
      height: 30,
      marginTop: 5, // Space between health bar and timer
      backgroundColor: 0x000000,
      textColor: '#FFA500', // Orange color
      fontSize: '20px',
      fontFamily: 'Courier New, monospace', // Digital clock font
      padding: 8,
      despawnMinutes: 10, // Boss despawns after 10 minutes
    },
  };

  constructor(scene: Phaser.Scene, bossName: string, maxHp: number, spawnTime: number) {
    this.scene = scene;
    this.bossName = bossName;
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.spawnTime = spawnTime;

    this.createHealthBar();
    this.createTimer();
    this.updatePosition();
    
    // Listen for camera changes to update position
    this.scene.cameras.main.on('followupdate', this.updatePosition, this);
    
    // Start timer updates
    this.startTimerUpdates();
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

  private createTimer(): void {
    const config = BossHealthBar.CONFIG;
    
    // Create timer container
    this.timerContainer = this.scene.add.container(0, 0);
    this.timerContainer.setDepth(config.depth);
    this.timerContainer.setAlpha(0); // Start invisible
    
    // Create timer background
    this.timerBackground = this.scene.add.graphics();
    
    // Create timer text
    this.timerText = this.scene.add.text(0, 0, '00:00', {
      fontSize: config.timer.fontSize,
      color: config.timer.textColor,
      fontFamily: config.timer.fontFamily,
    });
    this.timerText.setOrigin(0.5, 0.5);
    
    // Add to timer container
    this.timerContainer.add([this.timerBackground, this.timerText]);
    
    this.drawTimer();
  }

  private drawTimer(): void {
    const config = BossHealthBar.CONFIG;
    const timerWidth = 100; // Fixed width for timer display
    const timerHeight = config.timer.height;
    const halfWidth = timerWidth / 2;
    const halfHeight = timerHeight / 2;
    
    // Clear timer background
    this.timerBackground.clear();
    
    // Draw timer background (black)
    this.timerBackground.fillStyle(config.timer.backgroundColor, config.alpha);
    this.timerBackground.fillRoundedRect(
      -halfWidth,
      -halfHeight,
      timerWidth,
      timerHeight,
      config.cornerRadius
    );
    
    // Draw timer border
    this.timerBackground.lineStyle(config.borderWidth, config.borderColor, config.alpha);
    this.timerBackground.strokeRoundedRect(
      -halfWidth,
      -halfHeight,
      timerWidth,
      timerHeight,
      config.cornerRadius
    );
  }

  private updateTimer(): void {
    if (!this.timerText || !this.isVisible) return;
    
    const config = BossHealthBar.CONFIG;
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - this.spawnTime) / 1000);
    const totalSeconds = config.timer.despawnMinutes * 60;
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    
    // Format as MM:SS
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    this.timerText.setText(timeString);
    
    // Change color to red when time is running out (last minute)
    if (remainingSeconds <= 60) {
      this.timerText.setColor('#FF0000');
    } else {
      this.timerText.setColor(config.timer.textColor);
    }
  }

  private startTimerUpdates(): void {
    // Update timer every second
    this.timerUpdateInterval = window.setInterval(() => {
      this.updateTimer();
    }, 1000);
    
    // Initial update
    this.updateTimer();
  }

  private updatePosition(): void {
    if (!this.container || !this.timerContainer) return;
    
    const config = BossHealthBar.CONFIG;
    const camera = this.scene.cameras.main;
    
    // Position health bar at top of screen
    const x = camera.centerX;
    const y = camera.y + config.marginY + (config.height / 2);
    
    this.container.setPosition(x, y);
    
    // Position timer below health bar
    const timerY = y + (config.height / 2) + config.timer.marginTop + (config.timer.height / 2);
    this.timerContainer.setPosition(x, timerY);
  }

  public updateHealth(newHp: number): void {
    this.currentHp = Math.max(0, Math.min(this.maxHp, newHp));

    // Only hide health bar when boss dies
    if (newHp <= 0) {
      this.hide();
    }

    this.drawHealthBar();
  }

  public show(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.updatePosition(); // Ensure correct position
    
    // Fade in the health bar and timer
    this.scene.tweens.add({
      targets: [this.container, this.timerContainer],
      alpha: 1,
      duration: 300,
      ease: 'Power2.easeOut',
    });
  }

  public hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;

    // Fade out the health bar and timer
    this.scene.tweens.add({
      targets: [this.container, this.timerContainer],
      alpha: 0,
      duration: 500,
      ease: 'Power2.easeIn',
    });
  }

  public destroy(): void {
    // Remove camera listener
    this.scene.cameras.main.off('followupdate', this.updatePosition, this);
    
    // Clear timer interval
    if (this.timerUpdateInterval) {
      window.clearInterval(this.timerUpdateInterval);
    }
    
    if (this.container) {
      this.container.destroy();
    }
    
    if (this.timerContainer) {
      this.timerContainer.destroy();
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