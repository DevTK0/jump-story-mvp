import Phaser from 'phaser';
import type { DbConnection, Enemy as ServerEnemy } from '@/spacetime/client';

export interface EnemySubscriptionConfig {
  /** Use proximity-based subscriptions to limit enemies loaded */
  useProximitySubscription: boolean;
  /** Distance around player to load enemies (in pixels) */
  proximityRadius: number;
  /** Distance player must move before updating subscription (in pixels) */
  subscriptionDistanceThreshold?: number;
}

export interface EnemySubscriptionCallbacks {
  onEnemyInsert: (enemy: ServerEnemy) => void;
  onEnemyUpdate: (enemy: ServerEnemy) => void;
  onEnemyDelete: (enemyId: number) => void;
  onProximityLoad: (enemies: ServerEnemy[]) => void;
}

/**
 * Manages enemy subscriptions (proximity-based or global)
 */
export class EnemySubscriptionManager {
  private scene: Phaser.Scene;
  private dbConnection: DbConnection | null = null;
  private callbacks: EnemySubscriptionCallbacks;
  private config: EnemySubscriptionConfig;
  private lastSubscriptionCenter: { x: number; y: number } | null = null;

  // Default configuration
  private static readonly DEFAULT_CONFIG: EnemySubscriptionConfig = {
    useProximitySubscription: false,
    proximityRadius: 2000,
    subscriptionDistanceThreshold: 100,
  };

  constructor(
    scene: Phaser.Scene,
    callbacks: EnemySubscriptionCallbacks,
    config?: Partial<EnemySubscriptionConfig>
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.config = {
      ...EnemySubscriptionManager.DEFAULT_CONFIG,
      ...config,
    };
  }

  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    if (!this.dbConnection) return;

    if (this.config.useProximitySubscription) {
      this.setupProximityBasedSubscription();
    } else {
      this.setupGlobalSubscription();
    }
  }

  /**
   * Set up proximity-based subscription for better scalability
   */
  private setupProximityBasedSubscription(): void {
    if (!this.dbConnection) return;

    try {
      // Set up distance-based proximity checking
      this.setupDistanceBasedProximityUpdate();

      // Set up event listeners for targeted enemy data
      this.setupTargetedEnemyEventListeners();

      // Initial proximity subscription
      this.updateProximitySubscription();
    } catch (error) {
      console.error('EnemySubscriptionManager: Failed to set up proximity subscription:', error);
      // Fall back to global subscription
      this.setupGlobalSubscription();
    }
  }

  /**
   * Set up global subscription (original behavior)
   */
  private setupGlobalSubscription(): void {
    if (!this.dbConnection) return;

    // Subscribe to enemy table changes
    this.dbConnection.db.enemy.onInsert((_ctx, enemy) => {
      this.callbacks.onEnemyInsert(enemy);
    });

    this.dbConnection.db.enemy.onDelete((_ctx, enemy) => {
      this.callbacks.onEnemyDelete(enemy.enemyId);
    });

    this.dbConnection.db.enemy.onUpdate((_ctx, _oldEnemy, newEnemy) => {
      this.callbacks.onEnemyUpdate(newEnemy);
    });

    // Spawn existing enemies that are already in the database
    for (const enemy of this.dbConnection.db.enemy.iter()) {
      this.callbacks.onEnemyInsert(enemy);
    }
  }

  /**
   * Set up event listeners for proximity-based enemy subscription
   */
  private setupTargetedEnemyEventListeners(): void {
    if (!this.dbConnection) return;

    // With proximity subscription, events will only fire for nearby enemies
    this.dbConnection.db.enemy.onInsert((_ctx, enemy) => {
      this.callbacks.onEnemyInsert(enemy);
    });

    this.dbConnection.db.enemy.onDelete((_ctx, enemy) => {
      this.callbacks.onEnemyDelete(enemy.enemyId);
    });

    this.dbConnection.db.enemy.onUpdate((_ctx, _oldEnemy, newEnemy) => {
      this.callbacks.onEnemyUpdate(newEnemy);
    });
  }

  /**
   * Set up distance-based proximity update checking
   */
  private setupDistanceBasedProximityUpdate(): void {
    // Check player position every frame for distance-based updates
    this.scene.events.on('update', this.checkProximityDistanceUpdate, this);
  }

  /**
   * Check if player has moved far enough to warrant a proximity subscription update
   */
  private checkProximityDistanceUpdate(): void {
    if (!this.dbConnection) return;

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) return;

    // Calculate distance threshold (1/4 of proximity radius)
    const updateThreshold = this.config.proximityRadius * 0.25;

    // Check if we need to update based on distance moved
    if (this.lastSubscriptionCenter) {
      const distanceMoved = Math.sqrt(
        Math.pow(playerPosition.x - this.lastSubscriptionCenter.x, 2) +
          Math.pow(playerPosition.y - this.lastSubscriptionCenter.y, 2)
      );

      if (distanceMoved >= updateThreshold) {
        this.updateProximitySubscription();
      }
    } else {
      // First time - set initial center
      this.updateProximitySubscription();
    }
  }

  /**
   * Update proximity subscription based on current player position
   */
  private updateProximitySubscription(): void {
    if (!this.dbConnection) return;

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      console.warn(
        'EnemySubscriptionManager: Cannot update proximity subscription - player position unknown'
      );
      return;
    }

    // Update the last subscription center
    this.lastSubscriptionCenter = { x: playerPosition.x, y: playerPosition.y };

    const radius = this.config.proximityRadius;
    const minX = playerPosition.x - radius;
    const maxX = playerPosition.x + radius;
    const minY = playerPosition.y - radius;
    const maxY = playerPosition.y + radius;

    console.log(
      `🎯 EnemySubscriptionManager: Updating proximity subscription - Center: (${playerPosition.x}, ${playerPosition.y}), radius: ${radius}px`
    );

    try {
      // Subscribe to enemies within proximity using SQL query
      this.dbConnection
        .subscriptionBuilder()
        .onApplied(() => {
          this.loadProximityEnemies();
        })
        .subscribe([
          `SELECT * FROM Enemy 
                     WHERE x >= ${minX} AND x <= ${maxX}
                     AND y >= ${minY} AND y <= ${maxY}`,
        ]);
    } catch (error) {
      console.error('EnemySubscriptionManager: Failed to update proximity subscription:', error);
    }
  }

  /**
   * Load existing enemies within proximity when subscription is applied
   */
  private loadProximityEnemies(): void {
    if (!this.dbConnection) return;

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) return;

    const radius = this.config.proximityRadius;
    const nearbyEnemies: ServerEnemy[] = [];

    // Load enemies that are within proximity
    for (const enemy of this.dbConnection.db.enemy.iter()) {
      const distance = Math.sqrt(
        Math.pow(enemy.x - playerPosition.x, 2) + Math.pow(enemy.y - playerPosition.y, 2)
      );

      if (distance <= radius) {
        nearbyEnemies.push(enemy);
      }
    }

    // Notify about all enemies that should be loaded
    this.callbacks.onProximityLoad(nearbyEnemies);
  }

  /**
   * Get current player position from the scene
   */
  private getPlayerPosition(): { x: number; y: number } | null {
    // Try to get player from scene data
    const playgroundScene = this.scene as any;
    if (
      playgroundScene.player &&
      playgroundScene.player.x !== undefined &&
      playgroundScene.player.y !== undefined
    ) {
      return {
        x: playgroundScene.player.x,
        y: playgroundScene.player.y,
      };
    }

    // Fallback to camera center if player not accessible
    if (this.scene.cameras && this.scene.cameras.main) {
      const camera = this.scene.cameras.main;
      return {
        x: camera.centerX,
        y: camera.centerY,
      };
    }

    return null;
  }

  /**
   * Check if an enemy is within proximity (for updates)
   */
  public isEnemyInProximity(enemy: ServerEnemy): boolean {
    if (!this.config.useProximitySubscription) return true;

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) return true; // Default to showing if we can't determine

    const distance = Math.sqrt(
      Math.pow(enemy.x - playerPosition.x, 2) + Math.pow(enemy.y - playerPosition.y, 2)
    );

    return distance <= this.config.proximityRadius;
  }

  public destroy(): void {
    this.scene.events.off('update', this.checkProximityDistanceUpdate, this);
  }
}
