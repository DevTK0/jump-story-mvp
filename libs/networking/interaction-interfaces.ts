/**
 * TypeScript interfaces for interaction system
 * Replaces loose 'any' types with proper type safety
 */

import type { EnemyManager } from '@/enemy';

/**
 * Phaser sprite with physics body for game interactions
 */
export interface GameSprite extends Phaser.Physics.Arcade.Sprite {
  body: Phaser.Physics.Arcade.Body | null;
  active: boolean;
}

/**
 * Attack hitbox sprite (extends GameSprite for consistency)
 */
export interface AttackHitbox extends GameSprite {
  // Attack-specific properties can be added here if needed
}

/**
 * Player sprite with extended properties for touch interactions
 */
export interface PlayerSprite extends GameSprite {
  x: number;
  y: number;
}

/**
 * Enemy sprite with physics body for interactions
 */
export interface EnemySprite extends GameSprite {
  x: number;
  y: number;
}

/**
 * Database connection with typed reducers access
 */
export interface DatabaseConnection {
  reducers: {
    damageEnemy: (spawnIds: number[], attackType: any) => void;
    playerTakeDamage: (spawnId: number) => void;
    // Add other reducers as needed
  };
  db?: {
    player?: {
      iter(): Iterable<any>;
    };
  };
  identity?: {
    toString(): string;
  };
}

/**
 * Player attack event data structure
 */
export interface PlayerAttackEventData {
  attackType?: number;
  [key: string]: any; // Allow for extensibility
}

/**
 * Knockback direction vector
 */
export interface KnockbackDirection {
  x: number;
  y: number;
}

/**
 * Interaction callback signatures
 */
export interface InteractionCallbacks {
  onAttackHitEnemy: (_hitbox: AttackHitbox, enemy: EnemySprite) => void;
  onPlayerTouchEnemy: (player: PlayerSprite, enemy: EnemySprite) => void;
}

/**
 * Extended enemy manager interface for interaction handler
 */
export interface InteractionEnemyManager extends EnemyManager {
  getEnemyIdFromSprite(sprite: EnemySprite): number | null;
  canEnemyTakeDamage(spawnId: number): boolean;
  canEnemyDamagePlayer(spawnId: number): boolean;
  playHitAnimation(spawnId: number): void;
}
