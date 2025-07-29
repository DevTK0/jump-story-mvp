import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService } from '../services/ui-context-service';
import { ModalDialog } from './modal-dialog';
import type { Player } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

interface ProfileStats {
  name: string;
  level: number;
  jobName: string;
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  experience: number;
  isOnline: boolean;
  jobKey: string;
}

export class PlayerProfileDialog extends ModalDialog {
  private logger: ModuleLogger = createLogger('PlayerProfileDialog');
  private stats: ProfileStats;
  private playerIdentity: Identity;
  
  // UI elements
  private profileContainer!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private nameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private jobText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private manaBar!: Phaser.GameObjects.Graphics;
  private manaText!: Phaser.GameObjects.Text;
  private expText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, playerData: Player) {
    const dialogWidth = 400;
    const dialogHeight = 500;
    
    super(scene, dialogWidth, dialogHeight, 'Player Profile');
    
    this.playerIdentity = playerData.identity;
    this.stats = this.extractPlayerStats(playerData);
    
    this.createContent();
    this.subscribeToPlayerUpdates();
  }

  private extractPlayerStats(player: Player): ProfileStats {
    const uiContext = UIContextService.getInstance();
    const dbConnection = uiContext.getDbConnection();
    
    // Get job display name
    let jobName = player.job;
    if (dbConnection) {
      const job = dbConnection.db.job.jobKey.find(player.job);
      if (job) {
        jobName = job.displayName;
      }
    }
    
    return {
      name: player.name,
      level: player.level,
      jobName: jobName,
      currentHp: Math.round(player.currentHp),
      maxHp: Math.round(player.maxHp),
      currentMana: Math.round(player.currentMana),
      maxMana: Math.round(player.maxMana),
      experience: player.experience,
      isOnline: player.isOnline,
      jobKey: player.job
    };
  }

  protected createContent(): void {
    const centerX = 0;
    const startY = -this.dialogHeight / 2 + 60;
    
    // Create profile container
    this.profileContainer = this.scene.add.container(centerX, startY);
    this.contentContainer.add(this.profileContainer);
    
    // Player sprite
    this.createPlayerSprite(0, 20);
    
    // Player name
    this.createNameSection(0, 100);
    
    // Level and job
    this.createLevelJobSection(0, 130);
    
    // HP bar
    this.createHealthBar(0, 180);
    
    // Mana bar
    this.createManaBar(0, 240);
    
    // Experience
    this.createExperienceSection(0, 300);
    
    // Close button
    this.createCloseButton();
  }

  private createPlayerSprite(x: number, y: number): void {
    // Create sprite background
    const spriteBg = this.scene.add.rectangle(x, y, 80, 80, 0x000000, 0.3);
    spriteBg.setStrokeStyle(2, 0xffffff, 0.5);
    this.profileContainer.add(spriteBg);
    
    // Create player sprite - use the job key as the texture
    try {
      this.playerSprite = this.scene.add.sprite(x, y, this.stats.jobKey);
      this.playerSprite.setScale(2.5); // Make it bigger for profile view
      
      // Set to idle animation if it exists
      if (this.playerSprite.anims.exists(`${this.stats.jobKey}-idle`)) {
        this.playerSprite.play(`${this.stats.jobKey}-idle`);
      }
      
      this.profileContainer.add(this.playerSprite);
    } catch {
      this.logger.warn(`Failed to load sprite for job: ${this.stats.jobKey}`);
      // Fallback to a placeholder
      const placeholder = this.scene.add.text(x, y, '?', {
        fontSize: '40px',
        color: '#ffffff'
      });
      placeholder.setOrigin(0.5);
      this.profileContainer.add(placeholder);
    }
  }

  private createNameSection(x: number, y: number): void {
    // Player name
    this.nameText = this.scene.add.text(x, y, this.stats.name, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.nameText.setOrigin(0.5);
    this.profileContainer.add(this.nameText);
  }

  private createLevelJobSection(x: number, y: number): void {
    // Level
    this.levelText = this.scene.add.text(x - 80, y, `Level ${this.stats.level}`, {
      fontSize: '18px',
      color: '#ffdd00'
    });
    this.levelText.setOrigin(0.5);
    this.profileContainer.add(this.levelText);
    
    // Job
    this.jobText = this.scene.add.text(x + 80, y, this.stats.jobName, {
      fontSize: '18px',
      color: '#00ddff'
    });
    this.jobText.setOrigin(0.5);
    this.profileContainer.add(this.jobText);
  }

  private createHealthBar(x: number, y: number): void {
    const barWidth = 300;
    const barHeight = 24;
    
    // HP bar background
    const hpBarBg = this.scene.add.rectangle(x, y, barWidth, barHeight, 0x000000, 0.5);
    hpBarBg.setStrokeStyle(2, 0xffffff, 0.5);
    this.profileContainer.add(hpBarBg);
    
    // HP bar fill
    this.hpBar = this.scene.add.graphics();
    const hpPercentage = this.stats.currentHp / this.stats.maxHp;
    const hpFillWidth = (barWidth - 4) * hpPercentage;
    
    this.hpBar.fillStyle(0xff0000, 1);
    this.hpBar.fillRect(x - barWidth/2 + 2, y - barHeight/2 + 2, hpFillWidth, barHeight - 4);
    this.profileContainer.add(this.hpBar);
    
    // HP text
    this.hpText = this.scene.add.text(x, y, `${this.stats.currentHp} / ${this.stats.maxHp}`, {
      fontSize: '14px',
      color: '#ffffff'
    });
    this.hpText.setOrigin(0.5);
    this.profileContainer.add(this.hpText);
  }

  private createManaBar(x: number, y: number): void {
    const barWidth = 300;
    const barHeight = 24;
    
    // Mana bar background
    const manaBarBg = this.scene.add.rectangle(x, y, barWidth, barHeight, 0x000000, 0.5);
    manaBarBg.setStrokeStyle(2, 0xffffff, 0.5);
    this.profileContainer.add(manaBarBg);
    
    // Mana bar fill
    this.manaBar = this.scene.add.graphics();
    const manaPercentage = this.stats.currentMana / this.stats.maxMana;
    const manaFillWidth = (barWidth - 4) * manaPercentage;
    
    this.manaBar.fillStyle(0x0080ff, 1);
    this.manaBar.fillRect(x - barWidth/2 + 2, y - barHeight/2 + 2, manaFillWidth, barHeight - 4);
    this.profileContainer.add(this.manaBar);
    
    // Mana text
    this.manaText = this.scene.add.text(x, y, `${this.stats.currentMana} / ${this.stats.maxMana}`, {
      fontSize: '14px',
      color: '#ffffff'
    });
    this.manaText.setOrigin(0.5);
    this.profileContainer.add(this.manaText);
  }

  private createExperienceSection(x: number, y: number): void {
    const uiContext = UIContextService.getInstance();
    const dbConnection = uiContext.getDbConnection();
    
    // Get experience required for next level
    let expForNextLevel = 0;
    
    if (dbConnection) {
      const nextLevel = dbConnection.db.playerLevel.level.find(this.stats.level + 1);
      
      if (nextLevel) {
        // The expRequired field is the total exp needed to reach that level from current level
        expForNextLevel = nextLevel.expRequired;
      }
    }
    
    // Experience label
    const expLabel = this.scene.add.text(x, y, 'Experience', {
      fontSize: '16px',
      color: '#ffffff'
    });
    expLabel.setOrigin(0.5);
    this.profileContainer.add(expLabel);
    
    // Experience text - player.experience is current progress towards next level
    this.expText = this.scene.add.text(x, y + 25, `${this.stats.experience} / ${expForNextLevel} XP to next level`, {
      fontSize: '14px',
      color: '#ffdd00'
    });
    this.expText.setOrigin(0.5);
    this.profileContainer.add(this.expText);
  }

  private createCloseButton(): void {
    const buttonY = this.dialogHeight / 2 - 50;
    
    const closeButton = this.scene.add.rectangle(0, buttonY, 120, 40, 0x555555);
    closeButton.setStrokeStyle(2, 0xffffff);
    closeButton.setInteractive({ useHandCursor: true });
    
    const closeText = this.scene.add.text(0, buttonY, 'Close', {
      fontSize: '18px',
      color: '#ffffff'
    });
    closeText.setOrigin(0.5);
    
    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0x777777);
    });
    
    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0x555555);
    });
    
    closeButton.on('pointerdown', () => {
      this.hide();
    });
    
    this.contentContainer.add([closeButton, closeText]);
  }

  private subscribeToPlayerUpdates(): void {
    const uiContext = UIContextService.getInstance();
    const dbConnection = uiContext.getDbConnection();
    
    if (dbConnection) {
      // Subscribe to updates for this specific player
      dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
        // Check if this update is for the player we're showing
        if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
          // Update the stats and refresh the display
          this.stats = this.extractPlayerStats(newPlayer);
          this.updateDisplay();
        }
      });
    }
  }
  
  private updateDisplay(): void {
    // Update name
    if (this.nameText) {
      this.nameText.setText(this.stats.name);
    }
    
    // Update level
    if (this.levelText) {
      this.levelText.setText(`Level ${this.stats.level}`);
    }
    
    // Update job
    if (this.jobText) {
      this.jobText.setText(this.stats.jobName);
    }
    
    // Update HP
    if (this.hpText) {
      this.hpText.setText(`${this.stats.currentHp} / ${this.stats.maxHp}`);
    }
    if (this.hpBar) {
      const barWidth = 300;
      const barHeight = 24;
      const hpPercentage = this.stats.currentHp / this.stats.maxHp;
      const hpFillWidth = (barWidth - 4) * hpPercentage;
      
      this.hpBar.clear();
      this.hpBar.fillStyle(0xff0000, 1);
      this.hpBar.fillRect(-barWidth/2 + 2, -barHeight/2 + 2, hpFillWidth, barHeight - 4);
    }
    
    // Update Mana
    if (this.manaText) {
      this.manaText.setText(`${this.stats.currentMana} / ${this.stats.maxMana}`);
    }
    if (this.manaBar) {
      const barWidth = 300;
      const barHeight = 24;
      const manaPercentage = this.stats.currentMana / this.stats.maxMana;
      const manaFillWidth = (barWidth - 4) * manaPercentage;
      
      this.manaBar.clear();
      this.manaBar.fillStyle(0x0080ff, 1);
      this.manaBar.fillRect(-barWidth/2 + 2, -barHeight/2 + 2, manaFillWidth, barHeight - 4);
    }
    
    // Update experience
    if (this.expText) {
      const uiContext = UIContextService.getInstance();
      const dbConnection = uiContext.getDbConnection();
      let expForNextLevel = 0;
      
      if (dbConnection) {
        const nextLevel = dbConnection.db.playerLevel.level.find(this.stats.level + 1);
        if (nextLevel) {
          expForNextLevel = nextLevel.expRequired;
        }
      }
      
      this.expText.setText(`${this.stats.experience} / ${expForNextLevel} XP to next level`);
    }
  }
  
  public destroy(): void {
    if (this.playerSprite) {
      this.playerSprite.destroy();
    }
    if (this.hpBar) {
      this.hpBar.destroy();
    }
    if (this.manaBar) {
      this.manaBar.destroy();
    }
    super.destroy();
  }
}