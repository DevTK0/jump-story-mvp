import type { System } from '../core/types';
import { Player } from './player';
import { PlayerQueryService } from './player-query-service';
import { InputSystem } from './input';
import { DbConnection } from '@/spacetime/client';
import { PLAYER_CONFIG } from './config';
import { createLogger } from '../core/logger';
import { stateValidator } from '../core/state-validator';

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

        // Call the instakill reducer on the server
        if (this.dbConnection && this.dbConnection.reducers) {
            this.logger.info('💀 Triggering instakill...');
            
            try {
                // Call the instakillPlayer reducer (will be available after regenerating client bindings)
                if (this.dbConnection.reducers.instakillPlayer) {
                    this.dbConnection.reducers.instakillPlayer();
                    this.logger.info('💀 Instakill command sent to server');
                } else {
                    this.logger.warn('instakillPlayer reducer not found - you may need to regenerate client bindings');
                }
            } catch (error) {
                this.logger.error('❌ Error sending instakill command:', error);
            }
        } else {
            this.logger.warn('Database connection not available - cannot instakill');
        }
    }

    public destroy(): void {
        // No cleanup needed for this system
    }
}