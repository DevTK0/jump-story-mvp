/**
 * Player-specific Animation Manager
 * Manages sprite animations for the player character
 */

import Phaser from 'phaser';
import type { AnimationType } from './types';
import { AnimationFactory } from '@/animations';

/**
 * Player Animation Manager for controlling player sprite animations
 */
export class PlayerAnimationManager {
  private sprite: Phaser.GameObjects.Sprite;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite) {
    this.scene = scene;
    this.sprite = sprite;
  }

  /**
   * Play an animation by type, using the sprite's texture key
   */
  public play(animationType: AnimationType, ignoreIfPlaying: boolean = true): boolean {
    const spriteKey = this.sprite.texture.key;
    const animationKey = AnimationFactory.getAnimationKey(spriteKey, animationType);

    if (!this.scene.anims.exists(animationKey)) {
      console.warn(`Animation '${animationKey}' not found for sprite '${spriteKey}'`);
      return false;
    }

    if (ignoreIfPlaying && this.isPlaying(animationType)) {
      return false;
    }

    this.sprite.play(animationKey);
    return true;
  }


  /**
   * Stop current animation
   */
  public stop(): void {
    this.sprite.anims.stop();
  }

  /**
   * Get current animation key
   */
  public getCurrentAnimation(): string | null {
    return this.sprite.anims.currentAnim?.key || null;
  }

  /**
   * Check if a specific animation is playing
   */
  public isPlaying(animationType?: AnimationType): boolean {
    if (!animationType) {
      return this.sprite.anims.isPlaying;
    }

    const spriteKey = this.sprite.texture.key;
    const animationKey = AnimationFactory.getAnimationKey(spriteKey, animationType);
    return this.sprite.anims.isPlaying && this.getCurrentAnimation() === animationKey;
  }
}