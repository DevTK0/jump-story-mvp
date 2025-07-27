/**
 * Player Stats UI
 * Displays player health, mana, experience, and level using configuration-based approach
 */

import Phaser from 'phaser';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { PlayerQueryService } from '@/player';
import { PLAYER_STATS_UI_CONFIG, getBarColors, createTextStyle } from './player-stats-ui-config';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService } from '../services/ui-context-service';

export class PlayerStatsUI {
  private scene: Phaser.Scene;
  private dbConnection: DbConnection | null = null;
  private playerIdentity: Identity;
  private playerQueryService: PlayerQueryService | null = null;
  private logger: ModuleLogger = createLogger('PlayerStatsUI');

  // UI Elements
  private container!: Phaser.GameObjects.Container;
  private identityText!: Phaser.GameObjects.Text;
  private bars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private barBackgrounds: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private texts: Map<string, Phaser.GameObjects.Text> = new Map();

  // Performance optimization
  private lastUpdateTime: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Get data from context service
    const context = UIContextService.getInstance();
    this.playerIdentity = context.getPlayerIdentity()!;
    this.dbConnection = context.getDbConnection();
    
    this.createUI();
    
    // Initialize player query service if connection is available
    if (this.dbConnection) {
      this.playerQueryService = PlayerQueryService.getInstance(this.dbConnection);
      this.setupDataListener();
    }
  }

  private createUI(): void {
    const config = PLAYER_STATS_UI_CONFIG;

    // Create container for all UI elements
    this.container = this.scene.add.container(config.position.x, config.position.y);
    this.container.setDepth(config.display.baseDepth);
    this.container.setScrollFactor(config.display.scrollFactor.x, config.display.scrollFactor.y);

    // Create player identity text
    const identityStr = this.playerIdentity.toHexString();
    this.identityText = this.scene.add.text(0, 0, `Player: ${identityStr}`, {
      ...createTextStyle(),
      fontStyle: 'bold',
    });

    // Create bars in order: HP, Mana, EXP
    this.createBar('hp', 0);
    this.createBar('mana', 1);
    this.createBar('exp', 2);

    // Create level text
    const levelText = this.scene.add.text(
      0,
      config.position.identitySpacing + config.position.barSpacing * 3,
      'Level: 1',
      createTextStyle()
    );
    this.texts.set('level', levelText);

    // Remove the 'U' key handler since it's now handled by the level up animation manager

    // Add all elements to container
    const elements: Phaser.GameObjects.GameObject[] = [this.identityText];

    // Add bars and texts in order
    ['hp', 'mana', 'exp'].forEach((barType) => {
      const bg = this.barBackgrounds.get(barType);
      const bar = this.bars.get(barType);
      const text = this.texts.get(barType);
      if (bg) elements.push(bg);
      if (bar) elements.push(bar);
      if (text) elements.push(text);
    });

    const levelTextObj = this.texts.get('level');
    if (levelTextObj) elements.push(levelTextObj);

    this.container.add(elements);

    // Initial update
    this.updateStats(100, 100, 50, 50, 1, 0, 100);
  }

  /**
   * Create a bar with background and text
   */
  private createBar(type: 'hp' | 'mana' | 'exp', index: number): void {
    const config = PLAYER_STATS_UI_CONFIG;
    const colors = getBarColors(type);
    const yPos = config.position.identitySpacing + config.position.barSpacing * index;

    // Create background
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.background);
    bg.fillRect(0, yPos, config.position.barWidth, config.position.barHeight);
    bg.lineStyle(1, config.colors.barBorder);
    bg.strokeRect(0, yPos, config.position.barWidth, config.position.barHeight);
    this.barBackgrounds.set(type, bg);

    // Create fill bar
    const bar = this.scene.add.graphics();
    this.bars.set(type, bar);

    // Create text
    const labels = {
      hp: 'HP',
      mana: 'MP',
      exp: 'EXP',
    };
    const text = this.scene.add.text(
      config.position.barWidth + 10,
      yPos,
      `${labels[type]}: 0/0`,
      createTextStyle()
    );
    this.texts.set(type, text);
  }

  /**
   * Update bar display
   */
  private updateBar(
    type: 'hp' | 'mana' | 'exp',
    current: number,
    max: number,
    index: number
  ): void {
    const config = PLAYER_STATS_UI_CONFIG;
    const colors = getBarColors(type);
    const bar = this.bars.get(type);
    const text = this.texts.get(type);

    if (!bar || !text) return;

    const percentage = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    const yPos = config.position.identitySpacing + config.position.barSpacing * index;

    // Update bar fill
    bar.clear();
    bar.fillStyle(colors.fill);
    bar.fillRect(0, yPos, config.position.barWidth * percentage, config.position.barHeight);

    // Update text
    const labels = {
      hp: 'HP',
      mana: 'MP',
      exp: 'EXP',
    };
    text.setText(`${labels[type]}: ${Math.floor(current)}/${Math.floor(max)}`);
  }

  private updateStats(
    currentHp: number,
    maxHp: number,
    currentMana: number,
    maxMana: number,
    level: number,
    experience: number,
    expRequired: number
  ): void {
    // Throttle updates for performance
    const now = Date.now();
    if (now - this.lastUpdateTime < PLAYER_STATS_UI_CONFIG.performance.updateThrottle) {
      return;
    }
    this.lastUpdateTime = now;

    // Update bars
    this.updateBar('hp', currentHp, maxHp, 0);
    this.updateBar('mana', currentMana, maxMana, 1);
    this.updateBar('exp', experience, expRequired, 2);

    // Update level text
    const levelText = this.texts.get('level');
    if (levelText) {
      levelText.setText(`Level: ${level}`);
    }
  }

  public setDbConnection(_dbConnection: DbConnection): void {
    // No longer needed - gets from context in constructor
  }

  private setupDataListener(): void {
    if (!this.dbConnection) return;

    // Get the singleton PlayerQueryService
    this.playerQueryService = PlayerQueryService.getInstance();
    if (!this.playerQueryService) {
      this.logger.warn(
        'PlayerQueryService singleton not available, falling back to direct subscription'
      );
      this.setupFallbackSubscription();
      return;
    }

    this.setupSharedSubscriptionListeners();
    this.updateFromCurrentPlayerData();
  }

  private setupSharedSubscriptionListeners(): void {
    if (!this.dbConnection) return;

    // Listen to player updates
    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
        // Get exp required for next level
        const nextLevelConfig = this.findNextLevelConfig(newPlayer.level);
        const expRequired = nextLevelConfig?.expRequired || 0;

        this.updateStats(
          newPlayer.currentHp,
          newPlayer.maxHp,
          newPlayer.currentMana,
          newPlayer.maxMana,
          newPlayer.level,
          newPlayer.experience,
          expRequired
        );
      }
    });

    this.dbConnection.db.player.onInsert((_ctx, insertedPlayer) => {
      if (insertedPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
        const nextLevelConfig = this.findNextLevelConfig(insertedPlayer.level);
        const expRequired = nextLevelConfig?.expRequired || 0;

        this.updateStats(
          insertedPlayer.currentHp,
          insertedPlayer.maxHp,
          insertedPlayer.currentMana,
          insertedPlayer.maxMana,
          insertedPlayer.level,
          insertedPlayer.experience,
          expRequired
        );
      }
    });
  }

  private setupFallbackSubscription(): void {
    if (!this.dbConnection) return;

    this.logger.warn('Using fallback subscription - less efficient');

    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      if (newPlayer.identity.toHexString() === this.playerIdentity.toHexString()) {
        const nextLevelConfig = this.findNextLevelConfig(newPlayer.level);
        const expRequired = nextLevelConfig?.expRequired || 0;

        this.updateStats(
          newPlayer.currentHp,
          newPlayer.maxHp,
          newPlayer.currentMana,
          newPlayer.maxMana,
          newPlayer.level,
          newPlayer.experience,
          expRequired
        );
      }
    });

    this.updateFromCurrentPlayerData();
  }

  private updateFromCurrentPlayerData(): void {
    if (!this.playerQueryService || !this.dbConnection) return;

    const player = this.playerQueryService.findCurrentPlayer();
    if (player) {
      const nextLevelConfig = this.findNextLevelConfig(player.level);
      const expRequired = nextLevelConfig?.expRequired || 0;

      this.updateStats(
        player.currentHp,
        player.maxHp,
        player.currentMana,
        player.maxMana,
        player.level,
        player.experience,
        expRequired
      );
    }
  }

  private findNextLevelConfig(currentLevel: number) {
    if (!this.dbConnection) return null;

    // Debug: Check if we have any level data
    const levelConfigs = Array.from(this.dbConnection.db.playerLevel.iter());
    console.log('[PlayerStatsUI] PlayerLevel configs available:', levelConfigs.length);
    
    for (const config of levelConfigs) {
      if (config.level === currentLevel + 1) {
        console.log(`[PlayerStatsUI] Found next level config for level ${currentLevel + 1}: ${config.expRequired} exp`);
        return config;
      }
    }
    console.log(`[PlayerStatsUI] No config found for level ${currentLevel + 1}`);
    return null;
  }

  public getPlayerIdentity(): Identity {
    return this.playerIdentity;
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  public destroy(): void {
    this.container.destroy();
  }
}
