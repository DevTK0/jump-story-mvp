/**
 * Area Effect Renderer
 * Handles rendering and animating area-of-effect attacks (e.g., explosions, ground effects)
 */

import Phaser from 'phaser';
import { EnemyDamageEvent } from '@/spacetime/client';
import { PeerManager } from '@/peer';

interface AreaEffectState {
  sprite: Phaser.GameObjects.Sprite;
  startTime: number;
  duration: number;
  centerX: number;
  centerY: number;
}

export class AreaEffectRenderer {
  private scene: Phaser.Scene;
  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private peerManager: PeerManager | null = null;
  private localPlayerIdentity: string | null = null;
  private activeEffects: AreaEffectState[] = [];
  
  // Configuration
  private readonly EFFECT_DURATION = 600; // milliseconds
  private readonly EFFECT_DEPTH = 100; // Render below characters but above ground
  private readonly EFFECT_SCALE = 1.5;
  private readonly FADE_START = 0.7; // Start fading at 70% of duration
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set the player sprite reference for effect origin
   */
  public setPlayerSprite(playerSprite: Phaser.GameObjects.Sprite): void {
    this.playerSprite = playerSprite;
  }

  /**
   * Set the peer manager for getting peer sprites
   */
  public setPeerManager(peerManager: PeerManager): void {
    this.peerManager = peerManager;
  }

  /**
   * Set the local player identity for comparison
   */
  public setLocalPlayerIdentity(identity: string): void {
    this.localPlayerIdentity = identity;
  }

  /**
   * Create an area effect for a damage event
   */
  public createAreaEffect(damageEvent: EnemyDamageEvent): void {
    // Only render if skill_effect is specified (indicating an area attack)
    if (!damageEvent.skillEffect) {
      return;
    }

    // Determine the attacker sprite based on playerIdentity
    const attackerSprite = this.getAttackerSprite(damageEvent.playerIdentity.toHexString());
    if (!attackerSprite) {
      // Can't render effect without attacker position
      return;
    }

    // // Create area effect sprite at attacker's position
    // const effectSprite = this.scene.add.sprite(
    //   attackerSprite.x,
    //   attackerSprite.y,
    //   damageEvent.skillEffect
    // );

    // effectSprite.setDepth(this.EFFECT_DEPTH);
    // effectSprite.setScale(this.EFFECT_SCALE);
    
    // // Try to play animation if it exists
    // const animKey = `area_${damageEvent.skillEffect}`;
    // if (this.scene.anims.exists(animKey)) {
    //   effectSprite.play(animKey);
    // }

    // // Add to active effects for tracking
    // this.activeEffects.push({
    //   sprite: effectSprite,
    //   startTime: this.scene.time.now,
    //   duration: this.EFFECT_DURATION,
    //   centerX: attackerSprite.x,
    //   centerY: attackerSprite.y
    // });
  }

  /**
   * Update active area effects (fade out and cleanup)
   */
  public update(): void {
    const currentTime = this.scene.time.now;
    
    // Update and cleanup effects
    this.activeEffects = this.activeEffects.filter((effect) => {
      const elapsed = currentTime - effect.startTime;
      const progress = elapsed / effect.duration;

      if (progress >= 1) {
        // Effect complete, remove it
        effect.sprite.destroy();
        return false;
      }

      // Apply fade effect in the last portion of the duration
      if (progress >= this.FADE_START) {
        const fadeProgress = (progress - this.FADE_START) / (1 - this.FADE_START);
        effect.sprite.setAlpha(1 - fadeProgress);
      }

      return true;
    });
  }

  /**
   * Get the sprite for the attacker (local player or peer)
   */
  private getAttackerSprite(playerIdentity: string): Phaser.GameObjects.Sprite | null {
    // Check if it's the local player
    if (playerIdentity === this.localPlayerIdentity) {
      return this.playerSprite;
    }

    // Otherwise, look for a peer
    if (this.peerManager) {
      const peer = this.peerManager.getPeerSprite(playerIdentity);
      if (peer) {
        return peer;
      }
    }

    return null;
  }

  /**
   * Clean up all active effects
   */
  public destroy(): void {
    // Destroy all active effect sprites
    this.activeEffects.forEach((effect) => {
      effect.sprite.destroy();
    });
    this.activeEffects = [];
  }

  /**
   * Get the number of active effects (for debugging)
   */
  public getActiveEffectCount(): number {
    return this.activeEffects.length;
  }
}