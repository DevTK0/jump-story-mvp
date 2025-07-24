import type { System } from '../core/types';
import { Player } from './player';
import { PlayerQueryService } from './player-query-service';
import { DbConnection } from '@/spacetime/client';

export class RespawnSystem implements System {
    private player: Player;
    private dbConnection: DbConnection | null = null;
    private playerQueryService: PlayerQueryService | null = null;
    private lastRespawnTime: number = 0;
    private respawnCooldown: number = 1000; // 1 second cooldown to prevent spam

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
        this.playerQueryService = new PlayerQueryService(dbConnection);
    }

    public destroy(): void {
        // No cleanup needed for this system
    }
}