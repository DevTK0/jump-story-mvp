/**
 * Projectile Renderer Configuration
 * Central configuration for projectile animations and behavior
 */

export const PROJECTILE_RENDERER_CONFIG = {
  // Movement configuration
  movement: {
    speed: 75, // pixels per second
    minDuration: 300, // minimum milliseconds for visibility
    minDistance: 10, // distance threshold for completion in pixels
  },
  
  // Visual configuration
  visual: {
    depth: 100, // render depth for projectiles
    scale: 2, // scale multiplier for visibility
  },
  
  // Animation configuration
  animation: {
    scalePulse: {
      scale: 1.1,
      yoyo: true,
      ease: 'Sine.inOut',
    },
  },
} as const;

// Type exports for compile-time safety
export type ProjectileMovementConfig = typeof PROJECTILE_RENDERER_CONFIG.movement;
export type ProjectileVisualConfig = typeof PROJECTILE_RENDERER_CONFIG.visual;
export type ProjectileAnimationConfig = typeof PROJECTILE_RENDERER_CONFIG.animation;