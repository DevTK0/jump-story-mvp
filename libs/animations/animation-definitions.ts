/**
 * Animation timing constants and behaviors
 *
 * Note: Animation frame definitions have been moved to sprite-config.json
 * to maintain a single source of truth for sprite data
 */

/**
 * Animation timing constants for consistent durations across the game
 */
export const ANIMATION_TIMINGS = {
  // Attack animation durations (in milliseconds)
  ATTACK_DURATIONS: {
    attack1: 300, // Quick slash
    attack2: 600, // Heavy strike
    attack3: 450, // Combo attack
  },

  // State animation durations
  DAMAGED_DURATION: 400,
  INVULNERABILITY_DURATION: 1000,
  FLASH_INTERVAL: 100,
  MAX_FLASHES: 10,

  // Frame rates for different animation types
  DEFAULT_FRAME_RATES: {
    idle: 8,
    walk: 10,
    run: 15,
    attack: 20,
    damaged: 15,
    death: 12,
  },

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
 * Animation behavior configurations
 */
export const ANIMATION_BEHAVIORS = {
  // Which animations should loop
  LOOPING_ANIMATIONS: ['idle', 'walk', 'run'] as const,

  // Which animations should play once
  ONE_SHOT_ANIMATIONS: ['attack1', 'attack2', 'attack3', 'damaged', 'hit', 'death'] as const,

  // Which animations can be interrupted
  INTERRUPTIBLE_ANIMATIONS: ['idle', 'walk', 'run'] as const,

  // Which animations cannot be interrupted
  NON_INTERRUPTIBLE_ANIMATIONS: ['attack1', 'attack2', 'attack3', 'damaged', 'death'] as const,

  // Animation priorities (higher number = higher priority)
  ANIMATION_PRIORITIES: {
    idle: 1,
    walk: 2,
    run: 3,
    attack1: 10,
    attack2: 10,
    attack3: 10,
    hurt: 15,
    death: 20,
  } as const,
} as const;

/**
 * Helper function to check if an animation should loop
 */
export function shouldAnimationLoop(animationType: string): boolean {
  return ANIMATION_BEHAVIORS.LOOPING_ANIMATIONS.includes(animationType as any);
}

/**
 * Helper function to check if an animation can be interrupted
 */
export function canAnimationBeInterrupted(animationType: string): boolean {
  return ANIMATION_BEHAVIORS.INTERRUPTIBLE_ANIMATIONS.includes(animationType as any);
}

/**
 * Helper function to get animation priority
 */
export function getAnimationPriority(animationType: string): number {
  return (
    ANIMATION_BEHAVIORS.ANIMATION_PRIORITIES[
      animationType as keyof typeof ANIMATION_BEHAVIORS.ANIMATION_PRIORITIES
    ] ?? 1
  );
}
