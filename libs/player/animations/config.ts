/**
 * Player Animation Configuration
 * All player-specific animation constants and timings
 */

/**
 * Player animation timing constants
 */
export const PLAYER_ANIMATION_TIMINGS = {
  // Attack animation durations (in milliseconds)
  ATTACK_DURATIONS: {
    attack1: 1500, // Supports up to 1.5 second animations
    attack2: 1500, // Supports up to 1.5 second animations
    attack3: 1500, // Supports up to 1.5 second animations
  },

  // State animation durations
  DAMAGED_DURATION: 400,
  INVULNERABILITY_DURATION: 1000,
  FLASH_INTERVAL: 100,
  MAX_FLASHES: 10,

  // Knockback physics constants
  KNOCKBACK: {
    FORCE: 200, // Horizontal knockback force
    UPWARD_VELOCITY: 100, // Small upward velocity to lift off ground
    GROUND_THRESHOLD: 0.3, // Threshold to determine if knockback is ground-based
  },

  // Default fallback duration for unknown attack types
  DEFAULT_ATTACK_DURATION: 300,

  // Sprite frame indices
  SPRITE_FRAMES: {
    SOLDIER_DEATH_LAST_FRAME: 57, // Last frame of soldier death animation
  },
} as const;

/**
 * Player animation keys
 */
export const PLAYER_ANIMATION_KEYS = {
  IDLE: 'soldier-idle-anim',
  WALK: 'soldier-walk-anim',
  ATTACK1: 'soldier-attack1-anim',
  ATTACK2: 'soldier-attack2-anim',
  ATTACK3: 'soldier-attack3-anim',
  DAMAGED: 'soldier-damaged-anim',
  DEATH: 'soldier-death-anim',
} as const;