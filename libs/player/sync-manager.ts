import { DbConnection, PlayerState, FacingDirection, Player as ServerPlayer } from '@/spacetime/client';
import { Player } from './player';
import { PlayerQueryService } from './player-query-service';
import { PositionReconciliationService } from './movement/position-reconciliation-service';
import { PLAYER_CONFIG } from './config';

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
  private lastSyncedFacing: FacingDirection = { tag: "Right" };
  private lastSyncTime = 0;
  
  // State synchronization
  private currentPlayerState: PlayerState = { tag: "Idle" };
  
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
    
    // Set up position reconciliation monitoring
    this.setupPositionReconciliation();
  }
  
  private setupPositionReconciliation(): void {
    if (!this.dbConnection?.db?.player) return;
    
    // Subscribe to player position updates from server
    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      // Only process updates for the current player
      if (this.dbConnection && this.dbConnection.identity && 
          newPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()) {
        this.handleServerPositionUpdate(newPlayer);
      }
    });
  }
  
  private handleServerPositionUpdate(serverPlayer: ServerPlayer): void {
    // Skip reconciliation if player is dead - let death monitor handle respawn positioning
    if (serverPlayer.state.tag === 'Dead' || serverPlayer.currentHp <= 0) {
      return;
    }
    
    if (serverPlayer.position && 
        typeof serverPlayer.position.x === 'number' && 
        typeof serverPlayer.position.y === 'number') {
      
      const serverPos = { x: serverPlayer.position.x, y: serverPlayer.position.y };
      
      // Server position update received
      
      // Check if reconciliation is needed
      this.positionReconciliationService.checkAndReconcile(serverPos, (reconciledPos) => {
        // Update our last synced position to prevent immediate re-sync
        this.updateLastSyncedPosition(reconciledPos.x, reconciledPos.y);
      });
    }
  }
  
  public syncPosition(time: number, facing: FacingDirection, forceSync: boolean = false): void {
    if (!this.dbConnection) return;
    
    // Allow position sync even when dead so gravity/falling is visible to other players
    // The server will validate if dead players should be able to move
    
    const currentX = this.player.x;
    const currentY = this.player.y;
    const deltaX = Math.abs(currentX - this.lastSyncedPosition.x);
    const deltaY = Math.abs(currentY - this.lastSyncedPosition.y);
    
    // Check if facing changed
    const facingChanged = facing.tag !== this.lastSyncedFacing.tag;
    
    // Force sync on important events, or check normal conditions
    const shouldSync = forceSync || facingChanged ||
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
  
}