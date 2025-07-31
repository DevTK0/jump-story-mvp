import Phaser from 'phaser';

/**
 * Interface for validating hit detection
 * Used to provide type-safe access to combat system hit validation
 */
export interface IHitValidator {
  /**
   * Check if a hit on an enemy is valid based on attack-specific rules
   * @param enemy The enemy sprite that was hit
   * @returns true if the hit should be processed, false if it should be ignored
   */
  isHitValid(enemy: Phaser.GameObjects.Sprite): boolean;
}