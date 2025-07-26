/**
 * Animation Factory Module
 *
 * Provides standardized animation creation and management for Phaser games.
 * Includes factory pattern implementation, centralized configurations,
 * and utility classes for easy animation management.
 */

export {
  AnimationFactory,
  AnimationManager,
  type AnimationConfig,
  type AnimationFrameConfig,
  type SpriteAnimationSet,
} from './animation-factory';

// Player-specific animation components have been moved to libs/player/animations/
// getAnimationKey is now a static method on AnimationFactory
// Animation timings and behaviors have been moved to entity-specific configs
