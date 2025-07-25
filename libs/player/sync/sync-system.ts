import type { System } from '../../core/types';
import { Player } from '../player';
import { SyncManager } from './sync-manager';
import { MovementSystem } from '../movement/movement';
import { DbConnection, PlayerState } from '@/spacetime/client';
import { createLogger } from '../../core/logger';

/**
 * Handles all player synchronization with the server.
 * Separated from movement to maintain single responsibility principle.
 */
export class SyncSystem implements System {
  private player: Player;
  private syncManager: SyncManager;
  private movementSystem: MovementSystem | null = null;
  private logger = createLogger('SyncSystem');

  constructor(player: Player) {
    this.player = player;
    this.syncManager = new SyncManager(player);
  }

  public setMovementSystem(movementSystem: MovementSystem): void {
    this.movementSystem = movementSystem;
  }

  public setDbConnection(connection: DbConnection): void {
    this.syncManager.setDbConnection(connection);
  }

  update(time: number, _delta: number): void {
    if (!this.movementSystem) {
      this.logger.warn('Movement system not set - cannot sync');
      return;
    }

    // Get current facing direction from movement system
    const currentFacing = this.movementSystem.getCurrentFacing();

    // Check for special sync conditions
    let forceSync = false;

    // Force sync on important movement events
    const body = this.player.body;
    const onGround = body.onFloor();

    // Movement system tracks wasOnGround, but we need our own tracking for sync
    if (this.shouldForceSync(onGround)) {
      forceSync = true;
      this.logger.debug('Forcing position sync due to movement event');
    }

    // Sync position to server
    this.syncManager.syncPosition(time, currentFacing, forceSync);

    // Sync state to server if needed
    const newState = this.determinePlayerState();
    this.syncManager.syncState(newState);
  }

  private shouldForceSync(_onGround: boolean): boolean {
    // You could track landing/jumping events here if needed
    // For now, let SyncManager handle the sync timing
    return false;
  }

  private determinePlayerState(): PlayerState {
    // Use the state machine's current DB state
    return this.player.getStateMachine().getCurrentDbState();
  }

  public getSyncManager(): SyncManager {
    return this.syncManager;
  }

  destroy(): void {
    // Cleanup if needed
  }
}
