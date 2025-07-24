import type { System } from '../../core/types';
import { Player } from '../player';
import { PlayerQueryService } from '../services/player-query-service';
import { InputSystem } from '../input';
import { DbConnection } from '@/spacetime/client';
import { PLAYER_CONFIG } from '../config';
import { createLogger } from '../../core/logger';
import { stateValidator } from '../../core/state-validator';

export class RespawnSystem implements System {
    private player: Player;
    private dbConnection: DbConnection | null = null;
    private playerQueryService: PlayerQueryService | null = null;
    private lastRespawnTime: number = 0;
    private respawnCooldown: number = PLAYER_CONFIG.respawn.cooldown;
    private logger = createLogger('RespawnSystem');

    constructor(player: Player) {
        this.player = player;
    }

    update(time: number, _delta: number): void {
        const inputSystem = this.player.getSystem<InputSystem>('input');
        if (!inputSystem) return;

        // Check if respawn key was just pressed
        if (inputSystem.isJustPressed('respawn')) {
            this.logger.info('🔄 Respawn key (R) pressed!');
            this.handleRespawnInput(time);
        }

        // Check if instakill key was just pressed (for testing)
        if (inputSystem.isJustPressed('instakill')) {
            this.logger.info('💀 Instakill key (E) pressed!');
            this.handleInstakill();
        }
    }

    private handleRespawnInput(time: number): void {
        // Prevent respawn spam
        if (time - this.lastRespawnTime < this.respawnCooldown) {
            this.logger.debug('Respawn on cooldown');
            return;
        }

        // Only allow respawn if player is dead
        const respawnValidation = stateValidator.canPlayerPerformAction('respawn');
        if (!respawnValidation.isValid) {
            this.logger.warn(respawnValidation.reason || 'Cannot respawn');
            return;
        }

        // Call server respawn reducer
        if (this.dbConnection && this.dbConnection.reducers) {
            this.logger.info('✅ Requesting respawn from server...');
            try {
                this.dbConnection.reducers.respawnPlayer();
                this.lastRespawnTime = time;
                this.logger.info('✅ Respawn request sent successfully');
            } catch (error) {
                this.logger.error('❌ Error calling respawn reducer:', error);
            }
        } else {
            this.logger.warn('❌ Database connection not available - cannot respawn');
        }
    }

    private isPlayerDead(): boolean {
        return stateValidator.isCurrentPlayerDead();
    }

    public setDbConnection(dbConnection: DbConnection): void {
        this.dbConnection = dbConnection;
        this.playerQueryService = PlayerQueryService.getInstance();
        if (!this.playerQueryService) {
            this.logger.error('❌ RespawnSystem: PlayerQueryService singleton not available');
        }
    }

    private handleInstakill(): void {
        // Don't instakill if already dead
        if (this.isPlayerDead()) {
            this.logger.debug('Player is already dead');
            return;
        }

        // Instakill is now an admin-only feature and cannot be called from the client
        this.logger.warn('💀 Instakill is now an admin-only feature and has been disabled for security reasons');
        this.logger.info('💡 To test death mechanics, take damage from enemies instead');
    }

    public destroy(): void {
        // No cleanup needed for this system
    }
}