import Phaser from 'phaser';
import { Player } from '@/player';
import { EnemyManager } from '@/enemy';

export interface InteractionConfig {
    cameraShakeDuration?: number;
    cameraShakeIntensity?: number;
}

export class InteractionHandler {
    private scene: Phaser.Scene;
    private config: InteractionConfig;

    // Default configuration
    private static readonly DEFAULT_CONFIG: Required<InteractionConfig> = {
        cameraShakeDuration: 100,
        cameraShakeIntensity: 0.03
    };

    constructor(scene: Phaser.Scene, config?: InteractionConfig) {
        this.scene = scene;
        this.config = {
            ...InteractionHandler.DEFAULT_CONFIG,
            ...config
        };
    }

    /**
     * Handle when player's attack hits an enemy
     */
    public handleAttackHitEnemy(
        enemyManager: EnemyManager
    ): (_hitbox: any, enemy: any) => void {
        return (_hitbox: any, enemy: any) => {
            // Visual feedback for successful hit
            this.scene.cameras.main.shake(
                this.config.cameraShakeDuration,
                this.config.cameraShakeIntensity
            );

            // Get enemy ID from sprite and play hit animation
            const enemyId = enemyManager.getEnemyIdFromSprite(enemy);
            if (enemyId !== null) {
                enemyManager.playHitAnimation(enemyId);
                console.log('Enemy hit!', enemyId);
                // TODO: Call server reducer to damage/destroy enemy
            }
        };
    }

    /**
     * Handle when player touches an enemy (takes damage)
     */
    public handlePlayerTouchEnemy(player: Player): (player: any, enemy: any) => void {
        return (playerSprite: any, enemy: any) => {
            // Calculate knockback direction (away from enemy)
            const knockbackDirection = this.calculateKnockbackDirection(
                playerSprite,
                enemy
            );
            
            // Get the animation system and check/trigger damaged animation with knockback
            const animationSystem = player.getSystem("animations") as any;
            if (animationSystem && animationSystem.playDamagedAnimation) {
                // Only trigger damaged if not already invulnerable
                const wasDamaged = animationSystem.playDamagedAnimation(knockbackDirection);
                if (wasDamaged) {
                    console.log('Player damaged by enemy! Knockback direction:', knockbackDirection);
                    // TODO: Call server reducer to damage player
                }
            }
        };
    }

    /**
     * Calculate knockback direction from enemy to player
     */
    private calculateKnockbackDirection(
        player: any,
        enemy: any
    ): { x: number; y: number } {
        const playerPos = { x: player.x, y: player.y };
        const enemyPos = { x: enemy.x, y: enemy.y };
        
        // Calculate direction from enemy to player (away from enemy)
        const deltaX = playerPos.x - enemyPos.x;
        const deltaY = playerPos.y - enemyPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Normalize direction (prevent division by zero)
        return {
            x: distance > 0 ? deltaX / distance : 1, // Default right if same position
            y: distance > 0 ? deltaY / distance : 0
        };
    }

    /**
     * Set up all interaction callbacks at once
     */
    public createInteractionCallbacks(
        player: Player,
        enemyManager: EnemyManager
    ): {
        onAttackHitEnemy: (_hitbox: any, enemy: any) => void;
        onPlayerTouchEnemy: (player: any, enemy: any) => void;
    } {
        return {
            onAttackHitEnemy: this.handleAttackHitEnemy(enemyManager),
            onPlayerTouchEnemy: this.handlePlayerTouchEnemy(player)
        };
    }
}