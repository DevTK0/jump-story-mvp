/**
 * Projectile Renderer
 * Handles rendering and animating projectiles (e.g., arrows) that home to enemies
 */

import Phaser from 'phaser';
import { EnemyDamageEvent } from '@/spacetime/client';
import { EnemyManager } from '@/enemy';

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
  private activeProjectiles: ProjectileState[] = [];
  
  // Configuration
  private readonly PROJECTILE_SPEED = 400; // pixels per second
  private readonly PROJECTILE_DEPTH = 100;
  private readonly PROJECTILE_SCALE = 2; // Scale multiplier for visibility
  private readonly PROJECTILE_MIN_DISTANCE = 10; // Distance threshold for completion
  
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
   * Create a homing projectile for a damage event
   */
  public createProjectile(damageEvent: EnemyDamageEvent): void {
    if (!damageEvent.projectile || !this.enemyManager || !this.playerSprite) {
      return;
    }

    // Get enemy position
    const enemySprite = this.enemyManager.getEnemySprite(damageEvent.spawnId);
    if (!enemySprite || !enemySprite.visible) {
      return;
    }

    // Create projectile sprite
    const projectileSprite = this.scene.add.sprite(
      this.playerSprite.x,
      this.playerSprite.y, // Spawn from player's center
      damageEvent.projectile
    );

    projectileSprite.setDepth(this.PROJECTILE_DEPTH);
    projectileSprite.setScale(this.PROJECTILE_SCALE);
    
    // Try to play animation if it exists, otherwise just use the sprite
    const animKey = `projectile_${damageEvent.projectile}`;
    if (this.scene.anims.exists(animKey)) {
      projectileSprite.play(animKey);
    }

    // Calculate duration based on distance and speed
    const distance = Phaser.Math.Distance.Between(
      this.playerSprite.x,
      this.playerSprite.y,
      enemySprite.x,
      enemySprite.y
    );
    const calculatedDuration = (distance / this.PROJECTILE_SPEED) * 1000; // Convert to milliseconds
    const duration = Math.max(calculatedDuration, 300); // Minimum 300ms for visibility

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
            if (distance < this.PROJECTILE_MIN_DISTANCE) {
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
      scaleX: 1.1,
      scaleY: 1.1,
      duration: duration / 2,
      yoyo: true,
      ease: 'Sine.inOut',
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