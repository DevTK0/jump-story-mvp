import type { System } from '../core/types';
import { Player } from './player';

export class RespawnSystem implements System {
    private player: Player;
    private dbConnection: any = null;
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
        // Check if we have access to server player state
        if (this.dbConnection && this.dbConnection.db && this.dbConnection.db.player && this.dbConnection.identity) {
            // Get current player from server state
            for (const serverPlayer of this.dbConnection.db.player.iter()) {
                if (serverPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()) {
                    const isDead = serverPlayer.currentHp <= 0 || serverPlayer.state.tag === 'Dead';
                    console.log(`Respawn check - HP: ${serverPlayer.currentHp}, State: ${serverPlayer.state.tag}, isDead: ${isDead}`);
                    return isDead;
                }
            }
        }

        // Fallback: assume we can always try to respawn (server will validate)
        return true;
    }

    public setDbConnection(dbConnection: any): void {
        this.dbConnection = dbConnection;
    }

    public destroy(): void {
        // No cleanup needed for this system
    }
}