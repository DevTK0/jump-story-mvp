import { PlayerState } from "@/spacetime/client";

/**
 * Centralized service for enemy state validation and management
 * Eliminates duplicate dead enemy checking logic across components
 */
export interface EnemyStateService {
    isEnemyDead(enemyId: number): boolean;
    isEnemySpriteValid(sprite: Phaser.Physics.Arcade.Sprite): boolean;
    canEnemyTakeDamage(enemyId: number): boolean;
    canEnemyDamagePlayer(enemyId: number): boolean;
}

export class EnemyStateManager implements EnemyStateService {
    constructor(
        private enemies: Map<number, Phaser.Physics.Arcade.Sprite>,
        private enemyStates: Map<number, PlayerState>
    ) {}

    /**
     * Check if an enemy is dead based on its state
     */
    isEnemyDead(enemyId: number): boolean {
        const state = this.enemyStates.get(enemyId);
        return state?.tag === "Dead";
    }

    /**
     * Check if an enemy sprite is valid for interactions
     */
    isEnemySpriteValid(sprite: Phaser.Physics.Arcade.Sprite): boolean {
        return sprite.active && sprite.body !== null && sprite.body.enable === true;
    }

    /**
     * Check if an enemy can take damage (alive and interactive)
     */
    canEnemyTakeDamage(enemyId: number): boolean {
        const sprite = this.enemies.get(enemyId);
        return !this.isEnemyDead(enemyId) && 
               sprite !== undefined && 
               this.isEnemySpriteValid(sprite);
    }

    /**
     * Check if an enemy can damage the player (same logic but explicit semantic meaning)
     */
    canEnemyDamagePlayer(enemyId: number): boolean {
        return this.canEnemyTakeDamage(enemyId);
    }

    /**
     * Get enemy sprite by ID (helper method)
     */
    getEnemySprite(enemyId: number): Phaser.Physics.Arcade.Sprite | undefined {
        return this.enemies.get(enemyId);
    }

    /**
     * Check if enemy exists in the system
     */
    hasEnemy(enemyId: number): boolean {
        return this.enemies.has(enemyId);
    }
}