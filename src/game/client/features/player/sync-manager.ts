import { DbConnection, PlayerState } from '../../module_bindings';
import { Player } from './player';

export interface SyncConfig {
  positionThreshold: number;
  syncInterval: number;
}

export class SyncManager {
  private player: Player;
  private dbConnection: DbConnection | null = null;
  
  // Position synchronization
  private lastSyncedPosition = { x: 0, y: 0 };
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
  }
  
  public syncPosition(time: number, forceSync: boolean = false): void {
    if (!this.dbConnection) return;
    
    const currentX = this.player.x;
    const currentY = this.player.y;
    const deltaX = Math.abs(currentX - this.lastSyncedPosition.x);
    const deltaY = Math.abs(currentY - this.lastSyncedPosition.y);
    
    // Force sync on important events, or check normal conditions
    const shouldSync = forceSync || 
      (time - this.lastSyncTime >= this.config.syncInterval && 
       (deltaX > this.config.positionThreshold || deltaY > this.config.positionThreshold));
    
    if (shouldSync) {
      this.dbConnection.reducers.updatePlayerPosition(currentX, currentY);
      this.lastSyncedPosition = { x: currentX, y: currentY };
      this.lastSyncTime = time;
      
      if (forceSync) {
        console.log(`Forced position sync: (${currentX}, ${currentY})`);
      }
    }
  }
  
  public syncState(newState: PlayerState): void {
    if (!this.dbConnection) return;
    
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
  
  public getConfig(): Readonly<SyncConfig> {
    return { ...this.config };
  }
}