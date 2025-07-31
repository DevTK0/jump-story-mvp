/**
 * Projectile Renderer
 * Handles rendering and animating projectiles (e.g., arrows) that home to enemies
 */

import Phaser from 'phaser';
import { EnemyDamageEvent } from '@/spacetime/client';
import { EnemyManager } from '@/enemy';
import { PeerManager } from '@/peer';
import { PROJECTILE_RENDERER_CONFIG } from './projectile-renderer-config';
import { projectileSprites } from '../../../apps/playground/config/sprite-config';

interface ProjectileState {
  sprite: Phaser.GameObjects.Sprite;
  targetSpawnId: number;
  startTime: number;
  duration: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export class ProjectileRenderer {
  private scene: Phaser.Scene;
  private enemyManager: EnemyManager | null = null;
  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private peerManager: PeerManager | null = null;
  private localPlayerIdentity: string | null = null;
  private activeProjectiles: ProjectileState[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set the enemy manager reference for target positioning
   */
  public setEnemyManager(enemyManager: EnemyManager): void {
    this.enemyManager = enemyManager;
  }

  /**
   * Set the player sprite reference for projectile origin
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
   * Create a homing projectile for a damage event
   */
  public createProjectile(damageEvent: EnemyDamageEvent): void {
    if (!damageEvent.projectile || !this.enemyManager) {
      return;
    }

    // Get enemy position
    const enemySprite = this.enemyManager.getEnemySprite(damageEvent.spawnId);
    if (!enemySprite || !enemySprite.visible) {
      return;
    }

    // Determine the attacker sprite based on playerIdentity
    const attackerSprite = this.getAttackerSprite(damageEvent.playerIdentity);
    if (!attackerSprite) {
      // Can't render projectile without attacker sprite
      return;
    }

    // Create projectile sprite
    const projectileSprite = this.scene.add.sprite(
      attackerSprite.x,
      attackerSprite.y, // Spawn from attacker's center
      damageEvent.projectile
    );

    projectileSprite.setDepth(PROJECTILE_RENDERER_CONFIG.visual.depth);
    
    // Use scale from sprite config if available
    const projectileConfig = projectileSprites[damageEvent.projectile];
    const scale = projectileConfig?.scale || PROJECTILE_RENDERER_CONFIG.visual.scale;
    projectileSprite.setScale(scale);
    
    // Try to play animation if it exists, otherwise just use the sprite
    const animKey = `projectile_${damageEvent.projectile}`;
    if (this.scene.anims.exists(animKey)) {
      projectileSprite.play(animKey);
    }

    // Calculate duration based on distance and speed
    const distance = Phaser.Math.Distance.Between(
      attackerSprite.x,
      attackerSprite.y,
      enemySprite.x,
      enemySprite.y
    );
    const calculatedDuration = (distance / PROJECTILE_RENDERER_CONFIG.movement.speed) * 1000; // Convert to milliseconds
    const duration = Math.max(calculatedDuration, PROJECTILE_RENDERER_CONFIG.movement.minDuration); // Minimum duration for visibility

    // Create projectile state
    const projectileState: ProjectileState = {
      sprite: projectileSprite,
      targetSpawnId: damageEvent.spawnId,
      startTime: this.scene.time.now,
      duration: duration,
      startX: projectileSprite.x,
      startY: projectileSprite.y,
      targetX: enemySprite.x,
      targetY: enemySprite.y, // Aim for enemy's center
    };

    this.activeProjectiles.push(projectileState);

    // Start the projectile animation
    this.animateProjectile(projectileState);
  }

  /**
   * Animate a projectile to its target
   */
  private animateProjectile(projectileState: ProjectileState): void {
    const { sprite, targetX, targetY, duration } = projectileState;

    // Calculate angle to target for rotation
    const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, targetX, targetY);
    sprite.setRotation(angle);

    // Create homing animation
    this.scene.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Linear',
      onUpdate: () => {
        // Update rotation during flight for homing effect
        if (this.enemyManager) {
          const enemySprite = this.enemyManager.getEnemySprite(projectileState.targetSpawnId);
          if (enemySprite && enemySprite.visible) {
            const currentAngle = Phaser.Math.Angle.Between(
              sprite.x,
              sprite.y,
              enemySprite.x,
              enemySprite.y
            );
            sprite.setRotation(currentAngle);
            
            // Update target position for true homing
            projectileState.targetX = enemySprite.x;
            projectileState.targetY = enemySprite.y;
            
            // Check if projectile has reached the enemy
            const distance = Phaser.Math.Distance.Between(
              sprite.x,
              sprite.y,
              enemySprite.x,
              enemySprite.y
            );
            
            // If very close to enemy, complete immediately
            if (distance < PROJECTILE_RENDERER_CONFIG.movement.minDistance) {
              this.scene.tweens.killTweensOf(sprite);
              this.onProjectileComplete(projectileState);
            }
          }
        }
      },
      onComplete: () => {
        this.onProjectileComplete(projectileState);
      },
      onStop: () => {
        // Ensure cleanup if tween is stopped early
        this.onProjectileComplete(projectileState);
      },
    });

    // Add a subtle scale effect
    this.scene.tweens.add({
      targets: sprite,
      scaleX: PROJECTILE_RENDERER_CONFIG.animation.scalePulse.scale,
      scaleY: PROJECTILE_RENDERER_CONFIG.animation.scalePulse.scale,
      duration: duration / 2,
      yoyo: PROJECTILE_RENDERER_CONFIG.animation.scalePulse.yoyo,
      ease: PROJECTILE_RENDERER_CONFIG.animation.scalePulse.ease,
    });
  }

  /**
   * Handle projectile completion
   */
  private onProjectileComplete(projectileState: ProjectileState): void {
    // Check if sprite still exists (prevent double cleanup)
    if (!projectileState.sprite || !projectileState.sprite.active) {
      // Still remove from active list even if sprite is already destroyed
      const index = this.activeProjectiles.indexOf(projectileState);
      if (index > -1) {
        this.activeProjectiles.splice(index, 1);
      }
      return;
    }

    // Impact effect removed per user request

    // Kill all tweens on this sprite to prevent it from continuing
    this.scene.tweens.killTweensOf(projectileState.sprite);

    // Remove projectile
    projectileState.sprite.destroy();

    // Remove from active list
    const index = this.activeProjectiles.indexOf(projectileState);
    if (index > -1) {
      this.activeProjectiles.splice(index, 1);
    }
  }


  /**
   * Update projectiles (called each frame)
   */
  public update(): void {
    // Update homing for active projectiles
    this.activeProjectiles.forEach((projectileState) => {
      if (this.enemyManager) {
        const enemySprite = this.enemyManager.getEnemySprite(projectileState.targetSpawnId);
        if (enemySprite && enemySprite.visible) {
          // Smoothly update the tween target for true homing
          const activeTweens = this.scene.tweens.getTweensOf(projectileState.sprite);
          if (activeTweens.length > 0) {
            const tween = activeTweens[0];
            tween.updateTo('x', enemySprite.x, true);
            tween.updateTo('y', enemySprite.y, true);
          }
        }
      }
    });
  }

  /**
   * Get the attacker sprite based on player identity
   */
  private getAttackerSprite(attackerIdentity: any): Phaser.GameObjects.Sprite | null {
    // Convert identity to string for comparison
    const attackerIdString = attackerIdentity.toHexString();
    
    // Check if it's the local player
    if (attackerIdString === this.localPlayerIdentity) {
      return this.playerSprite;
    }
    
    // Otherwise, try to get peer sprite
    if (this.peerManager) {
      const peerSprite = this.peerManager.getPeerSprite(attackerIdString);
      if (peerSprite) {
        return peerSprite;
      }
    }
    
    // Fallback to player sprite if we can't find the peer
    // This handles cases where peer hasn't loaded yet
    return null;
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): Record<string, any> {
    return {
      activeProjectiles: this.activeProjectiles.length,
    };
  }

  /**
   * Destroy the renderer and clean up resources
   */
  public destroy(): void {
    // Clean up all active projectiles
    this.activeProjectiles.forEach((state) => {
      this.scene.tweens.killTweensOf(state.sprite);
      state.sprite.destroy();
    });

    this.activeProjectiles.length = 0;
  }
}