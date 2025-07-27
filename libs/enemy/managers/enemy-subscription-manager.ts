import Phaser from 'phaser';
import type { DbConnection, Enemy as ServerEnemy } from '@/spacetime/client';
import { buildProximityQuery, DEFAULT_PROXIMITY_CONFIGS } from '@/networking/subscription-utils';

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
  private cleanupFunctions: Array<() => void> = [];

  // Default configuration
  private static readonly DEFAULT_CONFIG: EnemySubscriptionConfig = {
    useProximitySubscription: false,
    proximityRadius: DEFAULT_PROXIMITY_CONFIGS.enemies.radius,
    subscriptionDistanceThreshold: DEFAULT_PROXIMITY_CONFIGS.enemies.moveThreshold,
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
    const onInsert = (_ctx: any, enemy: ServerEnemy) => {
      this.callbacks.onEnemyInsert(enemy);
    };
    const onDelete = (_ctx: any, enemy: ServerEnemy) => {
      this.callbacks.onEnemyDelete(enemy.enemyId);
    };
    const onUpdate = (_ctx: any, _oldEnemy: ServerEnemy, newEnemy: ServerEnemy) => {
      this.callbacks.onEnemyUpdate(newEnemy);
    };

    this.dbConnection.db.enemy.onInsert(onInsert);
    this.dbConnection.db.enemy.onDelete(onDelete);
    this.dbConnection.db.enemy.onUpdate(onUpdate);

    // Store cleanup functions
    this.cleanupFunctions.push(() => {
      if (this.dbConnection?.db?.enemy) {
        // Note: SpaceTimeDB SDK doesn't provide removeListener methods yet
        // This is a placeholder for when they add proper cleanup support
        // For now, we can only track that cleanup is needed
        console.log('EnemySubscriptionManager: Cleanup would remove enemy table listeners here');
      }
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
    const onInsert = (_ctx: any, enemy: ServerEnemy) => {
      this.callbacks.onEnemyInsert(enemy);
    };
    const onDelete = (_ctx: any, enemy: ServerEnemy) => {
      this.callbacks.onEnemyDelete(enemy.enemyId);
    };
    const onUpdate = (_ctx: any, _oldEnemy: ServerEnemy, newEnemy: ServerEnemy) => {
      this.callbacks.onEnemyUpdate(newEnemy);
    };

    this.dbConnection.db.enemy.onInsert(onInsert);
    this.dbConnection.db.enemy.onDelete(onDelete);
    this.dbConnection.db.enemy.onUpdate(onUpdate);

    // Store cleanup functions
    this.cleanupFunctions.push(() => {
      if (this.dbConnection?.db?.enemy) {
        // Note: SpaceTimeDB SDK doesn't provide removeListener methods yet
        console.log('EnemySubscriptionManager: Cleanup would remove targeted enemy listeners here');
      }
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

    console.log(
      `🎯 EnemySubscriptionManager: Updating proximity subscription - Center: (${playerPosition.x}, ${playerPosition.y}), radius: ${radius}px`
    );

    try {
      // Build safe proximity query
      const query = buildProximityQuery('Enemy', playerPosition.x, playerPosition.y, radius);

      // Subscribe to enemies within proximity using safe SQL query
      this.dbConnection
        .subscriptionBuilder()
        .onApplied(() => {
          this.loadProximityEnemies();
        })
        .subscribe([query]);
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
    // Remove Phaser event listeners
    this.scene.events.off('update', this.checkProximityDistanceUpdate, this);

    // Run all cleanup functions
    for (const cleanup of this.cleanupFunctions) {
      try {
        cleanup();
      } catch (error) {
        console.error('EnemySubscriptionManager: Error during cleanup:', error);
      }
    }
    this.cleanupFunctions = [];

    // Clear references
    this.dbConnection = null;
    this.lastSubscriptionCenter = null;

    console.log('EnemySubscriptionManager: Destroyed and cleaned up');
  }
}
