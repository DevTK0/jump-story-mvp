import Phaser from 'phaser';

export class BossHealthBar {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
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
    this.camera = scene.cameras.getCamera('ui') ?? scene.cameras.main;
    this.bossName = bossName;
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.spawnTime = spawnTime;

    this.createHealthBar();
    this.createTimer();
    
    // Start timer updates
    this.startTimerUpdates();
  }

  private createHealthBar(): void {
    const config = BossHealthBar.CONFIG;
    const centerX = this.camera.width / 2;
    const topY = config.marginY + (config.height / 2);
    
    this.container = this.scene.add.container(centerX, topY);
    this.container.setScrollFactor(0);
    this.container.setDepth(config.depth);
    this.container.setAlpha(0);

    this.background = this.scene.add.graphics();
    this.healthBar = this.scene.add.graphics();
    this.border = this.scene.add.graphics();

    this.bossNameText = this.scene.add.text(0, 0, this.bossName, config.nameStyle);
    this.bossNameText.setOrigin(0.5, 0.5);

    this.container.add([this.background, this.healthBar, this.border, this.bossNameText]);

    this.drawHealthBar();
  }

  private drawHealthBar(): void {
    const config = BossHealthBar.CONFIG;
    const width = this.camera.width - (config.marginX * 2);
    const height = config.height;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    this.background.clear();
    this.healthBar.clear();
    this.border.clear();

    this.background.fillStyle(config.backgroundColor, config.alpha);
    this.background.fillRoundedRect(
      -halfWidth,
      -halfHeight,
      width,
      height,
      config.cornerRadius
    );

    const healthPercentage = Math.max(0, this.currentHp / this.maxHp);
    const healthWidth = width * healthPercentage;

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

    this.border.lineStyle(config.borderWidth, config.borderColor, config.alpha);
    this.border.strokeRoundedRect(
      -halfWidth,
      -halfHeight,
      width,
      height,
      config.cornerRadius
    );

    this.bossNameText.setPosition(0, 0);
  }

  private createTimer(): void {
    const config = BossHealthBar.CONFIG;
    const centerX = this.camera.width / 2;
    const timerY = config.marginY + config.height + config.timer.marginTop + (config.timer.height / 2);
    
    this.timerContainer = this.scene.add.container(centerX, timerY);
    this.timerContainer.setScrollFactor(0);
    this.timerContainer.setDepth(config.depth);
    this.timerContainer.setAlpha(0);
    
    this.timerBackground = this.scene.add.graphics();
    
    this.timerText = this.scene.add.text(0, 0, '00:00', {
      fontSize: config.timer.fontSize,
      color: config.timer.textColor,
      fontFamily: config.timer.fontFamily,
    });
    this.timerText.setOrigin(0.5, 0.5);
    
    this.timerContainer.add([this.timerBackground, this.timerText]);
    
    this.drawTimer();
  }

  private drawTimer(): void {
    const config = BossHealthBar.CONFIG;
    const timerWidth = 100;
    const timerHeight = config.timer.height;
    const halfWidth = timerWidth / 2;
    const halfHeight = timerHeight / 2;
    
    this.timerBackground.clear();
    
    this.timerBackground.fillStyle(config.timer.backgroundColor, config.alpha);
    this.timerBackground.fillRoundedRect(
      -halfWidth,
      -halfHeight,
      timerWidth,
      timerHeight,
      config.cornerRadius
    );
    
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
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    this.timerText.setText(timeString);
    
    if (remainingSeconds <= 60) {
      this.timerText.setColor('#FF0000');
    } else {
      this.timerText.setColor(config.timer.textColor);
    }
  }

  private startTimerUpdates(): void {
    this.timerUpdateInterval = window.setInterval(() => {
      this.updateTimer();
    }, 1000);
    
    this.updateTimer();
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