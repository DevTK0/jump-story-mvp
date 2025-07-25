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
  type AnimationType,
} from './animation-factory';

export {
  ANIMATION_TIMINGS,
  ANIMATION_BEHAVIORS,
  shouldAnimationLoop,
  canAnimationBeInterrupted,
  getAnimationPriority,
} from './animation-definitions';
