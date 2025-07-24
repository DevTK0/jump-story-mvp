import { DbConnection } from '@/spacetime/client';
import { Player } from './player';
import type { System } from '@/core/types';
import { PlayerQueryService } from './player-query-service';

/**
 * Monitors player health and manages death state transitions
 */
export class DeathMonitor implements System {
    private player: Player;
    private dbConnection: DbConnection | null = null;
    private isDead: boolean = false;
    private playerQueryService: PlayerQueryService | null = null;
    
    constructor(player: Player) {
        this.player = player;
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
        
        // Server reconciliation - check if client and server positions are too far apart
        if (newPlayer && newPlayer.position) {
            const serverX = newPlayer.position.x;
            const serverY = newPlayer.position.y;
            const clientX = this.player.x;
            const clientY = this.player.y;
            const distance = Math.sqrt((serverX - clientX) ** 2 + (serverY - clientY) ** 2);
            
            // If positions are too far apart (> 300 pixels), reconcile to server position
            if (distance > 300) {
                console.log(`🔄 Server reconciliation: Client at (${clientX}, ${clientY}), Server at (${serverX}, ${serverY}), Distance: ${distance.toFixed(1)}`);
                console.log(`🚀 Teleporting client to server position`);
                this.player.setPosition(serverX, serverY);
                
                // Also update the sync manager's last synced position to prevent immediate override
                const movementSystem = this.player.getSystem('movement') as any;
                if (movementSystem?.syncManager) {
                    movementSystem.syncManager.updateLastSyncedPosition(serverX, serverY);
                }
            }
        }
        
        // Check if player just died (HP reached 0)
        if (oldHp > 0 && newHp <= 0) {
            console.log('Player died! Transitioning to Dead state');
            this.isDead = true;
            this.player.transitionToState("Dead");
        }
        // Check if player respawned (HP went from 0 to positive OR server state changed from Dead to something else)
        else if ((oldHp <= 0 && newHp > 0) || (this.isDead && newHp > 0 && serverState !== 'Dead')) {
            console.log('Player respawned! Transitioning to Idle state');
            this.isDead = false;
            this.player.transitionToState("Idle");
        }
        // Force Dead state if HP is 0 but client state isn't Dead yet
        else if (newHp <= 0 && !this.player.getStateMachine().isInState("Dead")) {
            console.log('Forcing Dead state - HP is 0 but state is not Dead');
            this.isDead = true;
            this.player.transitionToState("Dead");
        }
        // Also handle server state changes
        else if (serverState === 'Dead' && !this.player.getStateMachine().isInState("Dead")) {
            console.log('Server says player is dead, syncing state');
            this.isDead = true;
            this.player.transitionToState("Dead");
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