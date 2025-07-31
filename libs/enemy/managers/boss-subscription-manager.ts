import Phaser from 'phaser';
import { DbConnection, Spawn as ServerSpawn } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { createLogger } from '@/core/logger';
import { buildProximityQuery } from '@/networking/subscription-utils';

export interface BossSubscriptionConfig {
  useProximitySubscription: boolean;
  proximityRadius: number;
  proximityUpdateInterval: number;
}

export interface BossSubscriptionCallbacks {
  onBossInsert: (boss: ServerSpawn) => void;
  onBossUpdate: (boss: ServerSpawn) => void;
  onBossDelete: (spawnId: number) => void;
  onProximityLoad: (bosses: ServerSpawn[]) => void;
}

/**
 * Manages boss subscriptions with proximity-based loading
 */
export class BossSubscriptionManager {
  private scene: Phaser.Scene;
  private logger = createLogger('BossSubscriptionManager');
  private connection: DbConnection | null = null;
  private callbacks: BossSubscriptionCallbacks;
  private config: BossSubscriptionConfig;
  private proximityUpdateTimer?: Phaser.Time.TimerEvent;
  private localPlayerIdentity?: Identity;
  private lastKnownBosses = new Set<number>();

  constructor(
    scene: Phaser.Scene,
    callbacks: BossSubscriptionCallbacks,
    config?: Partial<BossSubscriptionConfig>
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.config = {
      useProximitySubscription: config?.useProximitySubscription ?? false,
      proximityRadius: config?.proximityRadius ?? 1000,
      proximityUpdateInterval: config?.proximityUpdateInterval ?? 1000,
    };
  }

  public setDbConnection(connection: DbConnection): void {
    this.connection = connection;
    this.setupSubscriptions();
  }

  public setLocalPlayerIdentity(identity: Identity): void {
    this.localPlayerIdentity = identity;
    
    // If we already have a connection and proximity is enabled, update subscriptions
    if (this.connection && this.config.useProximitySubscription) {
      this.cleanup();
      this.setupProximitySubscription();
    }
  }

  private setupSubscriptions(): void {
    if (!this.connection) return;

    if (this.config.useProximitySubscription) {
      this.setupProximitySubscription();
    } else {
      this.setupGlobalSubscription();
    }
  }

  private setupGlobalSubscription(): void {
    if (!this.connection) return;

    this.logger.info('Setting up global boss subscriptions...');

    // Subscribe to spawn table changes, filtering for bosses
    this.connection.db.spawn.onInsert((_ctx, spawn) => {
      if (spawn.enemyType.tag === 'Boss') {
        this.callbacks.onBossInsert(spawn);
      }
    });

    this.connection.db.spawn.onDelete((_ctx, spawn) => {
      if (spawn.enemyType.tag === 'Boss') {
        this.callbacks.onBossDelete(spawn.spawnId);
      }
    });

    this.connection.db.spawn.onUpdate((_ctx, _oldSpawn, newSpawn) => {
      if (newSpawn.enemyType.tag === 'Boss') {
        this.callbacks.onBossUpdate(newSpawn);
      }
    });

    // Load existing bosses
    const existingBosses = Array.from(this.connection.db.spawn.iter())
      .filter(spawn => spawn.enemyType.tag === 'Boss');
    
    this.logger.info(`Found ${existingBosses.length} existing bosses`);
    this.callbacks.onProximityLoad(existingBosses);
  }

  private setupProximitySubscription(): void {
    if (!this.connection || !this.localPlayerIdentity) {
      this.logger.warn('Cannot setup proximity subscription without connection and player identity');
      return;
    }

    this.logger.info(`Setting up proximity boss subscriptions (radius: ${this.config.proximityRadius})`);

    // Set up event listeners for boss events
    this.setupProximityEventListeners();

    // Initial proximity subscription
    this.updateProximitySubscription();

    // Set up periodic proximity updates
    this.proximityUpdateTimer = this.scene.time.addEvent({
      delay: this.config.proximityUpdateInterval,
      callback: this.updateProximitySubscription,
      callbackScope: this,
      loop: true,
    });
  }

  private setupProximityEventListeners(): void {
    if (!this.connection) return;

    // With proximity subscription, events will only fire for nearby bosses
    this.connection.db.spawn.onInsert((_ctx, spawn) => {
      if (spawn.enemyType.tag === 'Boss') {
        this.lastKnownBosses.add(spawn.spawnId);
        this.callbacks.onBossInsert(spawn);
      }
    });

    this.connection.db.spawn.onDelete((_ctx, spawn) => {
      if (spawn.enemyType.tag === 'Boss') {
        this.lastKnownBosses.delete(spawn.spawnId);
        this.callbacks.onBossDelete(spawn.spawnId);
      }
    });

    this.connection.db.spawn.onUpdate((_ctx, _oldSpawn, newSpawn) => {
      if (newSpawn.enemyType.tag === 'Boss') {
        this.callbacks.onBossUpdate(newSpawn);
      }
    });
  }

  private updateProximitySubscription(): void {
    if (!this.connection || !this.localPlayerIdentity) return;

    // Get player position
    const player = this.connection.db.player.identity.find(this.localPlayerIdentity);
    if (!player) {
      this.logger.warn('Local player not found for proximity subscription');
      return;
    }

    const playerX = player.x;
    const playerY = player.y;
    const radius = this.config.proximityRadius;

    try {
      // Build proximity query for bosses
      const query = buildProximityQuery('Spawn', playerX, playerY, radius);
      
      // Subscribe using the proximity query
      this.connection
        .subscriptionBuilder()
        .onApplied(() => {
          this.loadProximityBosses();
        })
        .subscribe([query]);
    } catch (error) {
      this.logger.error('Failed to update proximity subscription:', error);
    }
  }

  private loadProximityBosses(): void {
    if (!this.connection || !this.localPlayerIdentity) return;

    const player = this.connection.db.player.identity.find(this.localPlayerIdentity);
    if (!player) return;

    const radius = this.config.proximityRadius;
    const nearbyBosses: ServerSpawn[] = [];

    // Load bosses that are within proximity
    for (const spawn of this.connection.db.spawn.iter()) {
      if (spawn.enemyType.tag === 'Boss') {
        const distance = Math.sqrt(
          Math.pow(spawn.x - player.x, 2) + Math.pow(spawn.y - player.y, 2)
        );

        if (distance <= radius) {
          nearbyBosses.push(spawn);
        }
      }
    }

    this.callbacks.onProximityLoad(nearbyBosses);
    
    // Update last known bosses
    this.lastKnownBosses.clear();
    nearbyBosses.forEach(boss => this.lastKnownBosses.add(boss.spawnId));
  }

  public isProximityEnabled(): boolean {
    return this.config.useProximitySubscription;
  }

  public isBossInProximity(boss: ServerSpawn): boolean {
    // If not using proximity subscription, boss is always "in proximity"
    if (!this.config.useProximitySubscription) {
      return true;
    }

    // If we don't have a player identity yet, consider boss in proximity
    if (!this.localPlayerIdentity || !this.connection) {
      return true;
    }

    // Get player position
    const player = this.connection.db.player.identity.find(this.localPlayerIdentity);
    if (!player) {
      this.logger.warn('Could not find local player for proximity check');
      return true; // Default to in proximity if we can't find player
    }

    // Calculate distance between boss and player
    const distance = Math.sqrt(
      Math.pow(boss.x - player.x, 2) + Math.pow(boss.y - player.y, 2)
    );

    // Check if within proximity radius
    return distance <= this.config.proximityRadius;
  }

  public cleanup(): void {
    if (this.proximityUpdateTimer) {
      this.proximityUpdateTimer.destroy();
      this.proximityUpdateTimer = undefined;
    }

    this.lastKnownBosses.clear();
  }

  public destroy(): void {
    this.cleanup();
  }
}