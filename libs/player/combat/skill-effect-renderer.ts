import Phaser from 'phaser';
import type { EnemyDamageEvent } from '@/spacetime/client';
import type { PeerManager } from '@/peer';
import type { EnemyManager } from '@/enemy';
import { createLogger } from '@/core/logger';

const logger = createLogger('SkillEffectRenderer');

/**
 * SkillEffectRenderer - Renders skill visual effects on hit targets
 * 
 * Plays VFX animations on enemies when they are hit by skills with visual effects.
 * Effects play directly on the target without traveling (unlike projectiles).
 */
export class SkillEffectRenderer {
  private scene: Phaser.Scene;
  private activeEffects: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private enemyManager: EnemyManager | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(_peerManager: PeerManager, enemyManager: EnemyManager): void {
    this.enemyManager = enemyManager;
    logger.debug('Skill effect renderer initialized');
  }

  public handleDamageEvent(event: EnemyDamageEvent): void {
    // Only process events that have a skill effect
    if (!event.skillEffect) {
      return;
    }

    // Find the target enemy
    const enemySprite = this.enemyManager?.getEnemySprite(event.spawnId);
    if (!enemySprite) {
      logger.debug(`Enemy ${event.spawnId} not found for skill effect`);
      return;
    }

    // Create and play the skill effect on the target
    this.createSkillEffect(event.skillEffect, enemySprite);
  }

  private createSkillEffect(effectKey: string, target: Phaser.GameObjects.Sprite): void {
    // Create effect sprite at target position
    const effect = this.scene.add.sprite(
      target.x,
      target.y,
      effectKey
    );

    // Configure effect visual properties
    effect.setDepth(150); // Above enemies and projectiles
    effect.setScale(2); // Match game scale

    // Generate unique key for tracking
    const effectId = `${effectKey}_${Date.now()}_${Math.random()}`;
    this.activeEffects.set(effectId, effect);

    // Try to play the 'play' animation which should be created by the sprite loader
    const animKey = `${effectKey}_play`;
    if (this.scene.anims.exists(animKey)) {
      // Play existing animation
      effect.play(animKey);
      
      // If it's a looping animation, use a timer instead
      this.scene.time.delayedCall(600, () => {
        this.cleanupEffect(effectId, effect);
      });
    } else {
      // If no animation, play a default effect
      this.playDefaultEffect(effect, effectId);
    }

    logger.debug(`Created skill effect: ${effectKey} on enemy ${target.name}`);
  }

  private playDefaultEffect(effect: Phaser.GameObjects.Sprite, effectId: string): void {
    // Default effect: scale pulse and fade out
    this.scene.tweens.add({
      targets: effect,
      scale: { from: 2, to: 2.5 },
      alpha: { from: 1, to: 0 },
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        this.cleanupEffect(effectId, effect);
      }
    });

    // Add rotation for visual interest
    this.scene.tweens.add({
      targets: effect,
      angle: 360,
      duration: 600,
      ease: 'Linear'
    });
  }

  private cleanupEffect(effectId: string, effect: Phaser.GameObjects.Sprite): void {
    this.activeEffects.delete(effectId);
    effect.destroy();
  }

  destroy(): void {
    // Clean up all active effects
    this.activeEffects.forEach((effect) => {
      effect.destroy();
    });
    this.activeEffects.clear();
    
    logger.debug('Skill effect renderer destroyed');
  }
}