/**
 * Centralized configuration for enemy system
 * Eliminates magic numbers and provides single source of truth
 */

export const ENEMY_CONFIG = {
  /**
   * Visual display settings
   */
  display: {
    scale: 3, // Match player scale
    depth: 5, // Lower depth than player (player uses depth 10)
    deadDepth: 1, // Even lower depth for dead enemies
    origin: {
      x: 0.5,
      y: 0.5,
    },
  },

  /**
   * Physics body configuration
   */
  physics: {
    hitboxWidth: 10, // Match player hitbox size
    hitboxHeight: 10, // Match player hitbox size
    deathFallDelay: 500, // Milliseconds before disabling physics on death
    velocity: {
      x: 0, // No horizontal movement
      y: 0, // No vertical movement
    },
  },

  /**
   * Animation timing and behavior
   */
  animations: {
    frameRates: {
      idle: 8,
      walk: 10,
      hit: 15,
      death: 12,
    },
    timings: {
      hitAnimationComplete: 'animationcomplete',
      deathAnimationComplete: 'animationcomplete',
    },
  },

  /**
   * Combat and interaction settings
   */
  combat: {
    hitAnimationPriority: true,
    deathAnimationPriority: true,
  },

  /**
   * Health bar configuration
   */
  healthBar: {
    width: 32, // Health bar width in pixels (bigger)
    height: 4, // Health bar height in pixels (bigger)
    offsetY: -30, // Offset above enemy sprite (higher)
    backgroundColor: 0x000000, // Black background
    borderColor: 0xffffff, // White border
    healthColor: 0xff0000, // Always red health
    damageColor: 0xff0000, // Always red for damaged health
    borderWidth: 1, // Border thickness
    cornerRadius: 1, // Rounded corners
    alpha: 0.9, // Slight transparency
    showDuration: 3000, // Show for 3 seconds after damage
  },

  /**
   * Name label configuration
   */
  nameLabel: {
    offsetY: 25, // Position below the enemy sprite
    fontSize: '11px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
    depth: 6, // Above enemy sprite but below health bar
  },

  /**
   * Boss-specific configuration
   */
  boss: {
    display: {
      scale: 5, // Larger than regular enemies
      depth: 6, // Higher depth for prominence
      deadDepth: 2,
      origin: {
        x: 0.5,
        y: 0.5,
      },
    },
    healthBar: {
      width: 64, // Wider health bar for bosses
      height: 8, // Taller health bar
      offsetY: -40, // Higher offset due to larger sprite
      backgroundColor: 0x000000,
      borderColor: 0xffffff,
      healthColor: 0xff0000,
      damageColor: 0xff0000,
      borderWidth: 2,
      cornerRadius: 2,
      alpha: 0.9,
      showDuration: 5000, // Show longer for bosses
    },
    nameLabel: {
      offsetY: 40, // Lower due to larger sprite
      fontSize: '14px', // Larger font for bosses
      color: '#ffff00', // Yellow for boss names
      stroke: '#000000',
      strokeThickness: 3,
      depth: 7,
    },
  },

  /**
   * Enemy type configurations
   */
  types: {
    orc: {
      spriteKey: 'orc',
      defaultAnimation: 'idle',
      animations: ['idle', 'walk', 'hit', 'death'],
    },
    // Easy to extend for new enemy types
  },
} as const;

/**
 * Type-safe enemy configuration access
 */
export type EnemyType = keyof typeof ENEMY_CONFIG.types;
export type EnemyAnimationType = 'idle' | 'walk' | 'hit' | 'death';

/**
 * Get configuration for a specific enemy type
 */
export function getEnemyTypeConfig(enemyType: EnemyType) {
  return ENEMY_CONFIG.types[enemyType];
}

/**
 * Validate if an enemy type is supported
 */
export function isValidEnemyType(enemyType: string): enemyType is EnemyType {
  return enemyType in ENEMY_CONFIG.types;
}
