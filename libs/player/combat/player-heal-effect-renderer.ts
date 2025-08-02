import Phaser from 'phaser';
import type { PlayerHealEvent } from '@/spacetime/client';
import type { PeerManager } from '@/peer';
import type { Player } from '@/player';
import { skillEffectSprites } from '../../../apps/playground/config/sprite-config';

/**
 * PlayerHealEffectRenderer - Renders heal visual effects on player targets
 * 
 * Plays VFX animations on players when they are healed by abilities.
 * Effects play directly on the target player.
 */
export class PlayerHealEffectRenderer {
  private scene: Phaser.Scene;
  private activeEffects: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private peerManager: PeerManager | null = null;
  private player: Player | null = null;
  private localPlayerIdentity: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set the local player identity
   */
  public setLocalPlayerIdentity(identity: string): void {
    this.localPlayerIdentity = identity;
  }

  initialize(peerManager: PeerManager, player: Player): void {
    this.peerManager = peerManager;
    this.player = player;
  }

  public handleHealEvent(event: PlayerHealEvent): void {
    const eventTargetId = event.targetIdentity.toHexString();

    // Only process events that have a skill effect
    if (!event.skillEffect) {
      return;
    }

    // Find the target player sprite
    let targetSprite: Phaser.GameObjects.Sprite | null = null;

    // Check if it's the current player
    if (this.player && this.localPlayerIdentity) {
      const isLocalPlayer = eventTargetId === this.localPlayerIdentity;
      
      if (isLocalPlayer) {
        targetSprite = this.player;
      }
    }
    
    if (!targetSprite && this.peerManager) {
      // Check if it's a peer player
      const peerSprite = this.peerManager.getPeerSprite(eventTargetId);
      
      if (peerSprite) {
        targetSprite = peerSprite;
      }
    }

    if (!targetSprite) {
      return;
    }

    // Create and play the heal effect on the target
    this.createHealEffect(event.skillEffect, targetSprite);
  }

  private createHealEffect(effectKey: string, target: Phaser.GameObjects.Sprite): void {
    // Create effect sprite at target position
    const effect = this.scene.add.sprite(
      target.x,
      target.y,
      effectKey
    );

    // Configure effect visual properties
    effect.setDepth(150); // Above players
    
    // Use scale from sprite config if available
    const effectName = effectKey.replace('skillEffects_', '');
    const spriteConfig = skillEffectSprites[effectName];
    const scale = spriteConfig?.scale || 2;
    effect.setScale(scale);

    // Generate unique key for tracking
    const effectId = `${effectKey}_${Date.now()}_${Math.random()}`;
    this.activeEffects.set(effectId, effect);

    // Try to play the 'play' animation which should be created by the sprite loader
    const animKey = `${effectKey}_play`;
    if (this.scene.anims.exists(animKey)) {
      // Play existing animation
      effect.play(animKey);
      
      // If it's a looping animation, use a timer instead
      this.scene.time.delayedCall(800, () => {
        this.cleanupEffect(effectId, effect);
      });
    } else {
      // If no animation, play a default heal effect
      this.playDefaultHealEffect(effect, effectId);
    }
  }

  private playDefaultHealEffect(effect: Phaser.GameObjects.Sprite, effectId: string): void {
    // Default heal effect: upward movement with fade
    this.scene.tweens.add({
      targets: effect,
      y: effect.y - 30, // Move upward
      scale: { from: 1.5, to: 2.5 },
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        this.cleanupEffect(effectId, effect);
      }
    });

    // Add gentle rotation for visual interest
    this.scene.tweens.add({
      targets: effect,
      angle: 180,
      duration: 800,
      ease: 'Linear'
    });

    // Add a green tint to make it clearly a heal effect
    effect.setTint(0x00ff00);
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
  }
}