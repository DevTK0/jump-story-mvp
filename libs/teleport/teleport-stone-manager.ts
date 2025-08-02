import * as Phaser from 'phaser';
import { DbConnection, Teleport, PlayerTeleport } from '@/spacetime/client';
import { TeleportSubscriptionManager } from './managers/teleport-subscription-manager';
import { TeleportSpriteManager } from './managers/teleport-sprite-manager';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { emitSceneEvent } from '@/core/scene';

/**
 * Main teleport manager that orchestrates teleport subsystems
 * Follows the pattern established by EnemyManager
 */
export class TeleportStoneManager {
  private logger: ModuleLogger;
  private scene: Phaser.Scene;
  
  // Subsystem managers
  private subscriptionManager: TeleportSubscriptionManager;
  private spriteManager: TeleportSpriteManager;
  
  // State tracking
  private teleportLocations: Map<string, Teleport> = new Map();
  private playerUnlockStatus: Map<string, boolean> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('TeleportStoneManager');
    
    // Initialize subsystems
    this.spriteManager = new TeleportSpriteManager(scene);
    
    // Initialize subscription manager with callbacks
    this.subscriptionManager = new TeleportSubscriptionManager(scene, {
      onTeleportInsert: this.handleTeleportInsert.bind(this),
      onTeleportUpdate: this.handleTeleportUpdate.bind(this),
      onTeleportDelete: this.handleTeleportDelete.bind(this),
      onPlayerTeleportInsert: this.handlePlayerTeleportInsert.bind(this),
      onPlayerTeleportUpdate: this.handlePlayerTeleportUpdate.bind(this),
      onPlayerTeleportIdUpdate: this.handlePlayerTeleportIdUpdate.bind(this),
    });
  }

  public setDbConnection(connection: DbConnection): void {
    this.subscriptionManager.setDbConnection(connection);
  }

  /**
   * Handle teleport id update on player
   */
  private handlePlayerTeleportIdUpdate(teleportId: string): void {
    for (const [_key, teleport] of this.teleportLocations) {
      if (teleport.locationName !== teleportId) continue;
      const isUnlocked = this.playerUnlockStatus.get(teleport.locationName) || false;
      if (!isUnlocked) return;
      this.spriteManager.updateRespawnPoint(teleport.locationName);
    }
  }

  /**
   * Handle teleport location insertion
   */
  private handleTeleportInsert(teleport: Teleport): void {
    this.teleportLocations.set(teleport.locationName, teleport);
    this.spriteManager.createTeleportStone(teleport.locationName, teleport.x, teleport.y);
    this.emitTeleportDataUpdate();
  }

  /**
   * Handle teleport location update
   */
  private handleTeleportUpdate(teleport: Teleport): void {
    this.teleportLocations.set(teleport.locationName, teleport);
    
    // Remove old sprite and create new one at updated location
    this.spriteManager.removeTeleportStone(teleport.locationName);
    this.spriteManager.createTeleportStone(teleport.locationName, teleport.x, teleport.y);
    
    // Reapply unlock status if it exists
    const isUnlocked = this.playerUnlockStatus.get(teleport.locationName) || false;
    this.spriteManager.updateTeleportSprite(teleport.locationName, isUnlocked);
    
    this.emitTeleportDataUpdate();
  }

  /**
   * Handle teleport location deletion
   */
  private handleTeleportDelete(teleport: Teleport): void {
    this.teleportLocations.delete(teleport.locationName);
    this.spriteManager.removeTeleportStone(teleport.locationName);
    this.playerUnlockStatus.delete(teleport.locationName);
    this.emitTeleportDataUpdate();
  }

  /**
   * Handle player teleport unlock status insertion
   */
  private handlePlayerTeleportInsert(playerTeleport: PlayerTeleport): void {
    this.playerUnlockStatus.set(playerTeleport.locationName, playerTeleport.isUnlocked);
    this.spriteManager.updateTeleportSprite(playerTeleport.locationName, playerTeleport.isUnlocked);
    
    // Emit unlock event if this is an unlock
    if (playerTeleport.isUnlocked) {
      emitSceneEvent(this.scene, 'teleport:unlocked', {
        locationId: playerTeleport.locationName,
        locationName: playerTeleport.locationName
      });
    }
    
    this.emitTeleportDataUpdate();
  }

  /**
   * Handle player teleport unlock status update
   */
  private handlePlayerTeleportUpdate(playerTeleport: PlayerTeleport): void {
    const wasUnlocked = this.playerUnlockStatus.get(playerTeleport.locationName) || false;
    this.playerUnlockStatus.set(playerTeleport.locationName, playerTeleport.isUnlocked);
    this.spriteManager.updateTeleportSprite(playerTeleport.locationName, playerTeleport.isUnlocked);
    
    // Emit unlock event if status changed from locked to unlocked
    if (!wasUnlocked && playerTeleport.isUnlocked) {
      emitSceneEvent(this.scene, 'teleport:unlocked', {
        locationId: playerTeleport.locationName,
        locationName: playerTeleport.locationName
      });
    }
    
    this.emitTeleportDataUpdate();
  }

  /**
   * Emit scene event with current teleport data
   * This follows the event-driven pattern where game managers emit events
   * and UI components subscribe when ready
   */
  private emitTeleportDataUpdate(): void {
    const teleportTableData = Array.from(this.teleportLocations.values());
    
    // Emit type-safe scene event
    emitSceneEvent(this.scene, 'teleport:data-updated', {
      unlockStatus: new Map(this.playerUnlockStatus),
      locations: teleportTableData
    });
    
    this.logger.debug('Emitted teleport:data-updated event', {
      unlockCount: this.playerUnlockStatus.size,
      locationCount: teleportTableData.length
    });
  }

  /**
   * Clean up all managers
   */
  public destroy(): void {
    this.spriteManager.destroy();
    this.subscriptionManager.destroy();
    this.teleportLocations.clear();
    this.playerUnlockStatus.clear();
    this.logger.info('TeleportStoneManager destroyed');
  }
}