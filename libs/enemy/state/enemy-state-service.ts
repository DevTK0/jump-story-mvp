import { PlayerState } from '@/spacetime/client';

/**
 * Centralized service for enemy state validation and management
 * Eliminates duplicate dead enemy checking logic across components
 */
export interface EnemyStateService {
  isEnemyDead(spawnId: number): boolean;
  isEnemySpriteValid(sprite: Phaser.Physics.Arcade.Sprite): boolean;
  canEnemyTakeDamage(spawnId: number): boolean;
  canEnemyDamagePlayer(spawnId: number): boolean;
}

export class EnemyStateManager implements EnemyStateService {
  constructor(
    private enemies: Map<number, Phaser.Physics.Arcade.Sprite>,
    private enemyStates: Map<number, PlayerState>
  ) {}

  /**
   * Check if an enemy is dead based on its state
   */
  isEnemyDead(spawnId: number): boolean {
    const state = this.enemyStates.get(spawnId);
    return state?.tag === 'Dead';
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
  canEnemyTakeDamage(spawnId: number): boolean {
    const sprite = this.enemies.get(spawnId);
    return !this.isEnemyDead(spawnId) && sprite !== undefined && this.isEnemySpriteValid(sprite);
  }

  /**
   * Check if an enemy can damage the player (same logic but explicit semantic meaning)
   */
  canEnemyDamagePlayer(spawnId: number): boolean {
    return this.canEnemyTakeDamage(spawnId);
  }

  /**
   * Get enemy sprite by ID (helper method)
   */
  getEnemySprite(spawnId: number): Phaser.Physics.Arcade.Sprite | undefined {
    return this.enemies.get(spawnId);
  }

  /**
   * Check if enemy exists in the system
   */
  hasEnemy(spawnId: number): boolean {
    return this.enemies.has(spawnId);
  }
}
