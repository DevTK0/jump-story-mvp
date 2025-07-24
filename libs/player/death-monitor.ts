import { DbConnection } from '@/spacetime/client';
import { Player } from './player';
import type { System } from '@/core/types';
import { PlayerQueryService } from './player-query-service';
import { PositionReconciliationService } from './position-reconciliation-service';
import { DeathStateService } from './death-state-service';

/**
 * Monitors player health and manages death state transitions
 */
export class DeathMonitor implements System {
    private player: Player;
    private dbConnection: DbConnection | null = null;
    private isDead: boolean = false;
    private playerQueryService: PlayerQueryService | null = null;
    private positionReconciliationService: PositionReconciliationService;
    private deathStateService: DeathStateService;
    
    constructor(player: Player) {
        this.player = player;
        this.positionReconciliationService = new PositionReconciliationService(player);
        this.deathStateService = new DeathStateService(player);
    }
    
    public setDbConnection(connection: DbConnection): void {
        this.dbConnection = connection;
        this.playerQueryService = new PlayerQueryService(connection);
        
        // Subscribe to player updates
        if (this.dbConnection.db && this.dbConnection.db.player) {
            this.dbConnection.db.player.onUpdate((_ctx, oldPlayer, newPlayer) => {
                // Only process updates for the current player
                if (this.dbConnection && this.dbConnection.identity && 
                    newPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()) {
                    this.handlePlayerUpdate(oldPlayer?.currentHp || 100, newPlayer.currentHp, newPlayer.state.tag, newPlayer);
                }
            });
            
            // Check initial state using PlayerQueryService
            if (this.playerQueryService) {
                this.isDead = this.playerQueryService.isCurrentPlayerDead();
                
                // If player is already dead on connection, transition to dead state
                if (this.isDead && !this.player.getStateMachine().isInState("Dead")) {
                    this.player.transitionToState("Dead");
                }
            }
        }
    }
    
    private handlePlayerUpdate(oldHp: number, newHp: number, serverState: string, newPlayer: any): void {
        console.log(`Player HP changed: ${oldHp} -> ${newHp}, State: ${serverState}`);
        
        // Server position reconciliation with safe property access
        if (newPlayer && 
            newPlayer.position && 
            typeof newPlayer.position.x === 'number' && 
            typeof newPlayer.position.y === 'number') {
            
            const serverPos = { x: newPlayer.position.x, y: newPlayer.position.y };
            
            this.positionReconciliationService.checkAndReconcile(serverPos, (reconciledPos) => {
                // Update sync manager's position to prevent immediate override
                this.updateSyncManagerPosition(reconciledPos.x, reconciledPos.y);
            });
        }
        
        // Use death state service to determine what action to take
        const stateAction = this.deathStateService.determineStateAction(oldHp, newHp, serverState, this.isDead);
        
        // Execute the determined action
        this.executeStateAction(stateAction.action, stateAction.reason);
        
    }
    
    /**
     * Execute the determined state action
     * @param action The action to take
     * @param reason Reason for the action (for logging)
     */
    private executeStateAction(action: 'die' | 'respawn' | 'force_dead' | 'sync_dead' | 'none', reason: string): void {
        switch (action) {
            case 'die':
                console.log(reason);
                this.isDead = true;
                this.player.transitionToState("Dead");
                break;
                
            case 'respawn':
                console.log(reason);
                this.isDead = false;
                this.player.transitionToState("Idle");
                break;
                
            case 'force_dead':
                console.log(reason);
                this.isDead = true;
                this.player.transitionToState("Dead");
                break;
                
            case 'sync_dead':
                console.log(reason);
                this.isDead = true;
                this.player.transitionToState("Dead");
                break;
                
            case 'none':
                // No action needed
                break;
                
            default:
                console.warn(`Unknown death state action: ${action}`);
                break;
        }
    }
    
    /**
     * Helper method to update sync manager position after reconciliation
     * @param x New X position
     * @param y New Y position
     */
    private updateSyncManagerPosition(x: number, y: number): void {
        try {
            const movementSystem = this.player.getSystem('movement') as any;
            
            // Safe property access chain with explicit checks
            if (movementSystem && 
                typeof movementSystem === 'object' && 
                movementSystem.syncManager && 
                typeof movementSystem.syncManager.updateLastSyncedPosition === 'function') {
                
                movementSystem.syncManager.updateLastSyncedPosition(x, y);
            } else {
                console.warn('SyncManager not available for position update');
            }
        } catch (error) {
            console.error('Error updating sync manager position:', error);
        }
    }
    
    public isPlayerDead(): boolean {
        return this.isDead;
    }
    
    /**
     * Update method required by System interface
     * DeathMonitor is event-driven, so this is empty
     */
    public update(_time: number, _delta: number): void {
        // DeathMonitor works through SpacetimeDB subscriptions
        // No per-frame updates needed
    }
    
    /**
     * Cleanup method
     */
    public destroy(): void {
        // Subscriptions are cleaned up automatically when connection closes
    }
}