import type { System } from '../core/types';
import { Player } from './player';
import { PlayerQueryService } from './player-query-service';
import { DbConnection } from '@/spacetime/client';
import { PLAYER_CONFIG } from './config';

export class RespawnSystem implements System {
    private player: Player;
    private dbConnection: DbConnection | null = null;
    private playerQueryService: PlayerQueryService | null = null;
    private lastRespawnTime: number = 0;
    private respawnCooldown: number = PLAYER_CONFIG.respawn.cooldown;

    constructor(player: Player) {
        this.player = player;
    }

    update(time: number, _delta: number): void {
        const inputSystem = this.player.getSystem('input') as any;
        if (!inputSystem) return;

        // Check if respawn key was just pressed
        if (inputSystem.isJustPressed('respawn')) {
            console.log('🔄 Respawn key (R) pressed!');
            this.handleRespawnInput(time);
        }

        // Check if instakill key was just pressed (for testing)
        if (inputSystem.isJustPressed('instakill')) {
            console.log('💀 Instakill key (E) pressed!');
            this.handleInstakill();
        }
    }

    private handleRespawnInput(time: number): void {
        // Prevent respawn spam
        if (time - this.lastRespawnTime < this.respawnCooldown) {
            console.log('Respawn on cooldown');
            return;
        }

        // Only allow respawn if player is dead
        if (!this.isPlayerDead()) {
            console.log('Player is not dead, cannot respawn');
            return;
        }

        // Call server respawn reducer
        if (this.dbConnection && this.dbConnection.reducers) {
            console.log('✅ Requesting respawn from server...');
            try {
                this.dbConnection.reducers.respawnPlayer();
                this.lastRespawnTime = time;
                console.log('✅ Respawn request sent successfully');
            } catch (error) {
                console.error('❌ Error calling respawn reducer:', error);
            }
        } else {
            console.warn('❌ Database connection not available - cannot respawn');
        }
    }

    private isPlayerDead(): boolean {
        if (this.playerQueryService) {
            const player = this.playerQueryService.findCurrentPlayer();
            if (player) {
                const isDead = this.playerQueryService.isCurrentPlayerDead();
                console.log(`Respawn check - HP: ${player.currentHp}, State: ${player.state.tag}, isDead: ${isDead}`);
                return isDead;
            }
        }

        // Fallback: assume we can always try to respawn (server will validate)
        return true;
    }

    public setDbConnection(dbConnection: DbConnection): void {
        this.dbConnection = dbConnection;
        this.playerQueryService = PlayerQueryService.getInstance();
        if (!this.playerQueryService) {
            console.error('❌ RespawnSystem: PlayerQueryService singleton not available');
        }
    }

    private handleInstakill(): void {
        // Don't instakill if already dead
        if (this.isPlayerDead()) {
            console.log('Player is already dead');
            return;
        }

        // Call the instakill reducer on the server
        if (this.dbConnection && this.dbConnection.reducers) {
            console.log('💀 Triggering instakill...');
            
            try {
                // Call the instakillPlayer reducer (will be available after regenerating client bindings)
                if (this.dbConnection.reducers.instakillPlayer) {
                    this.dbConnection.reducers.instakillPlayer();
                    console.log('💀 Instakill command sent to server');
                } else {
                    console.warn('instakillPlayer reducer not found - you may need to regenerate client bindings');
                }
            } catch (error) {
                console.error('❌ Error sending instakill command:', error);
            }
        } else {
            console.warn('Database connection not available - cannot instakill');
        }
    }

    public destroy(): void {
        // No cleanup needed for this system
    }
}