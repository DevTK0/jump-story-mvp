import {
  DbConnection,
  PlayerState,
  FacingDirection,
  Player as ServerPlayer,
} from '@/spacetime/client';
import { Player } from '../player';
import { PlayerQueryService } from '../services/player-query-service';
import { PositionReconciliationService } from '../movement/position-reconciliation-service';
import { PLAYER_CONFIG } from '../config';

export interface SyncConfig {
  positionThreshold: number;
  syncInterval: number;
}

export class SyncManager {
  private player: Player;
  private dbConnection: DbConnection | null = null;
  private playerQueryService: PlayerQueryService | null = null;
  private positionReconciliationService: PositionReconciliationService;

  // Position and facing synchronization
  private lastSyncedPosition = { x: 0, y: 0 };
  private lastSyncedFacing: FacingDirection = { tag: 'Right' };
  private lastSyncTime = 0;

  // State synchronization
  private currentPlayerState: PlayerState = { tag: 'Idle' };
  private currentPlayerJob: string = 'soldier';

  // Configuration
  private config: SyncConfig;

  constructor(player: Player, config?: Partial<SyncConfig>) {
    this.player = player;
    this.config = {
      positionThreshold: config?.positionThreshold ?? PLAYER_CONFIG.position.syncThreshold,
      syncInterval: config?.syncInterval ?? PLAYER_CONFIG.position.syncInterval,
    };

    this.lastSyncedPosition = { x: player.x, y: player.y };
    this.positionReconciliationService = new PositionReconciliationService(player);
  }

  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    this.playerQueryService = PlayerQueryService.getInstance();
    if (!this.playerQueryService) {
      console.error('❌ SyncManager: PlayerQueryService singleton not available');
    }

    // Get initial player data to set current job
    if (connection.identity) {
      for (const player of connection.db.player.iter()) {
        if (player.identity.toHexString() === connection.identity.toHexString()) {
          console.log('[SyncManager] Found current player, job:', player.job);
          if (player.job) {
            this.currentPlayerJob = player.job;
          }
          break;
        }
      }
    }

    // Set up position reconciliation monitoring
    this.setupPositionReconciliation();
  }

  private setupPositionReconciliation(): void {
    if (!this.dbConnection?.db?.player) return;

    // Subscribe to player position updates from server
    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      console.log('[SyncManager] Player update received, identity:', newPlayer.identity.toHexString());
      // Only process updates for the current player
      if (
        this.dbConnection &&
        this.dbConnection.identity &&
        newPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()
      ) {
        console.log('[SyncManager] Update is for current player');
        this.handleServerPositionUpdate(newPlayer);
      } else {
        console.log('[SyncManager] Update is for different player');
      }
    });
  }

  private handleServerPositionUpdate(serverPlayer: ServerPlayer): void {
    console.log('[SyncManager] handleServerPositionUpdate called, job:', serverPlayer.job, 'current:', this.currentPlayerJob);
    
    // Skip reconciliation if player is dead - let death monitor handle respawn positioning
    if (serverPlayer.state.tag === 'Dead' || serverPlayer.currentHp <= 0) {
      return;
    }

    // Check for job change
    if (serverPlayer.job && serverPlayer.job !== this.currentPlayerJob) {
      console.log('[SyncManager] Job change detected:', this.currentPlayerJob, '->', serverPlayer.job);
      this.handleJobChange(serverPlayer.job);
    }

    if (typeof serverPlayer.x === 'number' && typeof serverPlayer.y === 'number') {
      const serverPos = { x: serverPlayer.x, y: serverPlayer.y };

      // Server position update received

      // Check if reconciliation is needed
      this.positionReconciliationService.checkAndReconcile(serverPos, (reconciledPos) => {
        // Update our last synced position to prevent immediate re-sync
        this.updateLastSyncedPosition(reconciledPos.x, reconciledPos.y);
      });
    }
  }

  private handleJobChange(newJob: string): void {
    console.log(`[SyncManager] handleJobChange: Job changing from ${this.currentPlayerJob} to ${newJob}`);
    this.currentPlayerJob = newJob;

    // Update player texture/sprite
    console.log('[SyncManager] Setting texture to:', newJob);
    this.player.setTexture(newJob);
    
    // Reset animation to idle for the new job
    const animKey = `${newJob}_idle`;
    console.log('[SyncManager] Looking for animation:', animKey);
    if (this.player.scene.anims.exists(animKey)) {
      console.log('[SyncManager] Playing animation:', animKey);
      this.player.play(animKey);
    } else {
      console.log('[SyncManager] Animation not found:', animKey);
    }

    // Emit event for other systems to handle job change
    this.player.emit('jobChanged', newJob);
    console.log('[SyncManager] Job change complete');
  }

  public syncPosition(time: number, facing: FacingDirection, forceSync: boolean = false): void {
    if (!this.dbConnection) return;

    // Don't sync position if dead (HP <= 0) - this prevents teleport issues
    if (this.isPlayerDead()) {
      return;
    }

    const currentX = this.player.x;
    const currentY = this.player.y;
    const deltaX = Math.abs(currentX - this.lastSyncedPosition.x);
    const deltaY = Math.abs(currentY - this.lastSyncedPosition.y);

    // Check if facing changed
    const facingChanged = facing.tag !== this.lastSyncedFacing.tag;

    // Force sync on important events, or check normal conditions
    const shouldSync =
      forceSync ||
      facingChanged ||
      (time - this.lastSyncTime >= this.config.syncInterval &&
        (deltaX > this.config.positionThreshold || deltaY > this.config.positionThreshold));

    if (shouldSync) {
      // Sending position update to server
      this.dbConnection.reducers.updatePlayerPosition(currentX, currentY, facing);
      this.lastSyncedPosition = { x: currentX, y: currentY };
      this.lastSyncedFacing = facing;
      this.lastSyncTime = time;

      if (forceSync) {
        // Forced position sync
      }
    }
  }

  public syncState(newState: PlayerState): void {
    if (!this.dbConnection) return;

    // Don't sync non-death states if player is dead (HP <= 0)
    if (this.isPlayerDead() && newState.tag !== 'Dead') {
      console.log(`Prevented state sync to ${newState.tag} - player is dead`);
      return;
    }

    // Only sync if state actually changed
    if (newState.tag !== this.currentPlayerState.tag) {
      this.dbConnection.reducers.updatePlayerState(newState);
      this.currentPlayerState = newState;
      console.log(`Updated player state to: ${newState.tag}`);
    }
  }

  public getCurrentState(): PlayerState {
    return this.currentPlayerState;
  }

  public getLastSyncedPosition(): { x: number; y: number } {
    return { ...this.lastSyncedPosition };
  }

  public updateLastSyncedPosition(x: number, y: number): void {
    this.lastSyncedPosition.x = x;
    this.lastSyncedPosition.y = y;
    console.log(`Updated last synced position to (${x}, ${y})`);
  }

  public getConfig(): Readonly<SyncConfig> {
    return { ...this.config };
  }

  private isPlayerDead(): boolean {
    return this.playerQueryService?.isCurrentPlayerDead() ?? false;
  }

  public isPlayerDeadPublic(): boolean {
    return this.isPlayerDead();
  }

  /**
   * Special position sync for dead players - only called when they hit the ground
   */
  public syncPositionForDead(time: number, facing: FacingDirection): void {
    if (!this.dbConnection) return;

    const currentX = this.player.x;
    const currentY = this.player.y;

    console.log(`Dead player landed - syncing final position (${currentX}, ${currentY})`);

    // Force sync the landing position
    this.dbConnection.reducers.updatePlayerPosition(currentX, currentY, facing);
    this.lastSyncedPosition = { x: currentX, y: currentY };
    this.lastSyncedFacing = facing;
    this.lastSyncTime = time;
  }
}
