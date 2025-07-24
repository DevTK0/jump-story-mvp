import { DbConnection, PlayerState, FacingDirection } from '@/spacetime/client';
import { Player } from './player';
import { PlayerQueryService } from './player-query-service';

export interface SyncConfig {
  positionThreshold: number;
  syncInterval: number;
}

export class SyncManager {
  private player: Player;
  private dbConnection: DbConnection | null = null;
  private playerQueryService: PlayerQueryService | null = null;
  
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
      positionThreshold: config?.positionThreshold ?? 10, // pixels
      syncInterval: config?.syncInterval ?? 200, // milliseconds
    };
    
    this.lastSyncedPosition = { x: player.x, y: player.y };
  }
  
  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    this.playerQueryService = new PlayerQueryService(connection);
  }
  
  public syncPosition(time: number, facing: FacingDirection, forceSync: boolean = false): void {
    if (!this.dbConnection) return;
    
    // Don't sync position if player is dead or client thinks it's dead
    if (this.isPlayerDead() || this.player.getStateMachine().isInState("Dead")) {
      return;
    }
    
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
      this.dbConnection.reducers.updatePlayerPosition(currentX, currentY, facing);
      this.lastSyncedPosition = { x: currentX, y: currentY };
      this.lastSyncedFacing = facing;
      this.lastSyncTime = time;
      
      if (forceSync) {
        console.log(`Forced position sync: (${currentX}, ${currentY}) facing ${facing.tag}`);
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