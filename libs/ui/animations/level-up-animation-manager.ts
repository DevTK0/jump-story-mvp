/**
 * Level Up Animation Manager
 * Centralized manager for all player level up animations (local and peers)
 */

import Phaser from 'phaser';
import { LevelUpRenderer } from './level-up-renderer';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

export class LevelUpAnimationManager {
  private levelUpRenderer: LevelUpRenderer;
  private dbConnection: DbConnection | null = null;

  constructor(scene: Phaser.Scene) {
    this.levelUpRenderer = new LevelUpRenderer(scene);
  }

  /**
   * Initialize the manager with database connection
   */
  public initialize(dbConnection: DbConnection, _localPlayerIdentity: Identity): void {
    this.dbConnection = dbConnection;
    this.levelUpRenderer.initialize(dbConnection);
    this.setupLevelUpSubscriptions();
  }

  /**
   * Register a sprite for smooth animation tracking
   */
  public registerSprite(identity: Identity, sprite: Phaser.GameObjects.Sprite): void {
    this.levelUpRenderer.registerPlayerSprite(identity, sprite);
  }

  /**
   * Set up database subscriptions for level up events
   */
  private setupLevelUpSubscriptions(): void {
    if (!this.dbConnection) return;

    // Listen to all player updates (local and peers)
    this.dbConnection.db.player.onUpdate((_ctx, oldPlayer, newPlayer) => {
      // Check for level up
      if (oldPlayer && oldPlayer.level < newPlayer.level) {
        // Show level up animation for any player
        this.levelUpRenderer.showLevelUpAnimation(newPlayer.identity, newPlayer.level);
      }
    });
  }

  /**
   * Manually trigger a level up animation (for testing)
   */
  public triggerLevelUpAnimation(identity: Identity, level: number): void {
    this.levelUpRenderer.showLevelUpAnimation(identity, level);
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.levelUpRenderer.destroy();
  }
}
