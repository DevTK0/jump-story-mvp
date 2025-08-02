import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService } from '../services/ui-context-service';
import { jobAttributes } from '../../../apps/playground/config/job-attributes';
import type { JobConfig } from '@/player/combat/attack-types';

export class AttackInfoMenu {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private logger: ModuleLogger = createLogger('AttackInfoMenu');

  private isVisible: boolean = false;
  
  public get visible(): boolean {
    return this.isVisible;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    this.createUI();
    this.hide(); // Start hidden

    // Setup escape key to close
    this.scene.input.keyboard?.on('keydown-ESC', () => {
      if (this.isVisible) {
        this.hide();
      }
    });
  }

  private createUI(): void {
    // Create main container
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(2000); // High depth to appear above everything

    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const centerY = camera.height / 2;

    // Create semi-transparent background overlay
    const overlay = this.scene.add.rectangle(
      centerX,
      centerY,
      camera.width,
      camera.height,
      0x000000,
      0.7
    );
    overlay.setInteractive(); // Block clicks from going through

    // Create menu background
    const menuWidth = 680;
    const menuHeight = 600;
    this.background = this.scene.add.rectangle(centerX, centerY, menuWidth, menuHeight, 0x2a2a2a);
    this.background.setStrokeStyle(2, 0x4a4a4a);

    // Create title
    const title = this.scene.add.text(centerX, centerY - menuHeight / 2 + 40, 'Attack Information', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0.5);

    // Create instruction text
    const instruction = this.scene.add.text(centerX, centerY - menuHeight / 2 + 70, 'Press A or ESC to close', {
      fontSize: '14px',
      color: '#cccccc',
      fontStyle: 'italic',
    });
    instruction.setOrigin(0.5, 0.5);

    // Add all to container
    this.container.add([overlay, this.background, title, instruction]);

    // Create attack info content
    this.createAttackInfo(centerX, centerY, menuWidth, menuHeight);
  }

  private createAttackInfo(centerX: number, centerY: number, _menuWidth: number, menuHeight: number): void {
    // Get current player's job
    const context = UIContextService.getInstance();
    const connection = context.getDbConnection();
    const identity = context.getPlayerIdentity();
    let currentJob = 'soldier'; // default

    if (connection && identity) {
      for (const player of connection.db.player.iter()) {
        if (player.identity.toHexString() === identity.toHexString()) {
          currentJob = player.job || 'soldier';
          break;
        }
      }
    }

    // Get job config
    const jobConfig: JobConfig | undefined = jobAttributes[currentJob];
    if (!jobConfig) {
      this.logger.warn(`Job config not found for ${currentJob}`);
      return;
    }

    // Job info
    const jobText = this.scene.add.text(centerX, centerY - menuHeight / 2 + 100, `${jobConfig.displayName}`, {
      fontSize: '20px',
      color: '#ffff00',
      fontStyle: 'bold',
    });
    jobText.setOrigin(0.5, 0.5);
    this.container.add(jobText);

    // Create 3 vertical skill cards
    const cardWidth = 180;
    const cardHeight = 400;
    const cardSpacing = 20;
    const totalCardsWidth = cardWidth * 3 + cardSpacing * 2;
    const startX = centerX - totalCardsWidth / 2 + cardWidth / 2;
    const cardY = centerY + 30;

    // Map attacks to X, C, V keys
    const skillCards = [
      { key: 'X', attackKey: 'attack1' },
      { key: 'C', attackKey: 'attack2' },
      { key: 'V', attackKey: 'attack3' }
    ];

    skillCards.forEach((card, cardIndex) => {
      const cardX = startX + cardIndex * (cardWidth + cardSpacing);

      // Card background
      const cardBg = this.scene.add.rectangle(cardX, cardY, cardWidth, cardHeight, 0x3a3a3a);
      cardBg.setStrokeStyle(2, 0x5a5a5a);
      this.container.add(cardBg);

      // Get the attack for this card
      const attack = jobConfig.attacks?.[card.attackKey as keyof typeof jobConfig.attacks];
      
      // Skills in this card
      let skillY = cardY - cardHeight / 2 + 40;
      
      if (attack) {
        // Skill name with card key
        const nameText = this.scene.add.text(cardX, skillY, 
          `${card.key} - ${attack.name}`, {
          fontSize: '16px',
          color: '#00ff00',
          fontStyle: 'bold',
        });
        nameText.setOrigin(0.5, 0.5);
        this.container.add(nameText);
        skillY += 35;
        
        // Description (with word wrap for card width)
        const descText = this.scene.add.text(cardX, skillY, 
          attack.description, {
          fontSize: '11px',
          color: '#cccccc',
          wordWrap: { width: cardWidth - 20 },
          align: 'center',
        });
        descText.setOrigin(0.5, 0);
        this.container.add(descText);
        skillY += descText.height + 15;
        
        // Stats
        const statsText = this.scene.add.text(cardX, skillY, 
          `Damage: ${attack.damage}\nCooldown: ${attack.cooldown}s\nRange: ${attack.range}`, {
          fontSize: '12px',
          color: '#ffff00',
          align: 'center',
          lineSpacing: 5,
        });
        statsText.setOrigin(0.5, 0);
        this.container.add(statsText);
      } else {
        const emptyText = this.scene.add.text(cardX, cardY, 
          `${card.key} - [Empty Slot]`, {
          fontSize: '16px',
          color: '#666666',
        });
        emptyText.setOrigin(0.5, 0.5);
        this.container.add(emptyText);
      }
    });
  }

  public show(): void {
    this.logger.info('Showing AttackInfoMenu');
    this.container.setVisible(true);
    this.isVisible = true;
  }

  public hide(): void {
    this.container.setVisible(false);
    this.isVisible = false;
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public destroy(): void {
    this.container.destroy();
  }
}