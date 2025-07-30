import Phaser from 'phaser';
import type { DbConnection, Teleport, PlayerTeleport, EventContext } from '@/spacetime/client';
import { createLogger, type ModuleLogger } from '@/core/logger';

export interface TeleportSubscriptionCallbacks {
  onTeleportInsert: (teleport: Teleport) => void;
  onTeleportUpdate: (teleport: Teleport) => void;
  onTeleportDelete: (teleport: Teleport) => void;
  onPlayerTeleportInsert: (playerTeleport: PlayerTeleport) => void;
  onPlayerTeleportUpdate: (playerTeleport: PlayerTeleport) => void;
}

/**
 * Manages teleport-related SpacetimeDB subscriptions
 * Follows the pattern established by EnemySubscriptionManager
 */
export class TeleportSubscriptionManager {
  private dbConnection: DbConnection | null = null;
  private callbacks: TeleportSubscriptionCallbacks;
  private playerIdentityHex: string | null = null;
  private logger: ModuleLogger;
  private cleanupFunctions: Array<() => void> = [];

  constructor(
    _scene: Phaser.Scene,
    callbacks: TeleportSubscriptionCallbacks
  ) {
    this.callbacks = callbacks;
    this.logger = createLogger('TeleportSubscriptionManager');
  }

  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    
    if (connection.identity) {
      this.playerIdentityHex = connection.identity.toHexString();
    }
    
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    if (!this.dbConnection) return;

    // Subscribe to teleport tables
    this.subscribeTeleportTables();
    
    // Register event handlers
    this.registerEventHandlers();
  }

  private subscribeTeleportTables(): void {
    if (!this.dbConnection || !this.playerIdentityHex) return;

    this.dbConnection
      .subscriptionBuilder()
      .onApplied(() => {
        this.logger.info('Teleport subscriptions applied');
        this.loadExistingTeleports();
      })
      .subscribe([
        'SELECT * FROM Teleport',
        `SELECT * FROM PlayerTeleport WHERE player_identity = x'${this.playerIdentityHex}'`
      ]);
  }

  private registerEventHandlers(): void {
    if (!this.dbConnection) return;

    // Teleport table handlers
    const onTeleportInsert = (_ctx: EventContext, teleport: Teleport) => {
      this.callbacks.onTeleportInsert(teleport);
    };
    
    const onTeleportUpdate = (_ctx: EventContext, _oldTeleport: Teleport, newTeleport: Teleport) => {
      this.callbacks.onTeleportUpdate(newTeleport);
    };
    
    const onTeleportDelete = (_ctx: EventContext, teleport: Teleport) => {
      this.callbacks.onTeleportDelete(teleport);
    };

    this.dbConnection.db.teleport.onInsert(onTeleportInsert);
    this.dbConnection.db.teleport.onUpdate(onTeleportUpdate);
    this.dbConnection.db.teleport.onDelete(onTeleportDelete);

    // PlayerTeleport table handlers
    const onPlayerTeleportInsert = (_ctx: EventContext, playerTeleport: PlayerTeleport) => {
      if (playerTeleport.playerIdentity.toHexString() === this.playerIdentityHex) {
        this.callbacks.onPlayerTeleportInsert(playerTeleport);
      }
    };
    
    const onPlayerTeleportUpdate = (_ctx: EventContext, _oldData: PlayerTeleport, newData: PlayerTeleport) => {
      if (newData.playerIdentity.toHexString() === this.playerIdentityHex) {
        this.callbacks.onPlayerTeleportUpdate(newData);
      }
    };

    this.dbConnection.db.playerTeleport.onInsert(onPlayerTeleportInsert);
    this.dbConnection.db.playerTeleport.onUpdate(onPlayerTeleportUpdate);

    // Store cleanup functions for future use
    this.cleanupFunctions.push(() => {
      // SpaceTimeDB SDK doesn't provide removeListener methods yet
      // This is a placeholder for when they add proper cleanup support
    });
  }

  private loadExistingTeleports(): void {
    if (!this.dbConnection) return;

    // Load all existing teleport locations
    const teleports = Array.from(this.dbConnection.db.teleport.iter());
    for (const teleport of teleports) {
      this.callbacks.onTeleportInsert(teleport);
    }

    // Load player's teleport unlock states
    const playerTeleports = Array.from(this.dbConnection.db.playerTeleport.iter());
    const myTeleports = playerTeleports.filter(
      (pt) => pt.playerIdentity.toHexString() === this.playerIdentityHex
    );

    for (const playerTeleport of myTeleports) {
      this.callbacks.onPlayerTeleportInsert(playerTeleport);
    }
  }

  public destroy(): void {
    // Run all cleanup functions
    for (const cleanup of this.cleanupFunctions) {
      try {
        cleanup();
      } catch (error) {
        this.logger.error('Error during cleanup:', error);
      }
    }
    this.cleanupFunctions = [];

    // Clear references
    this.dbConnection = null;
    this.playerIdentityHex = null;
  }
}