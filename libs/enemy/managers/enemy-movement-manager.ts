import Phaser from 'phaser';
import type { Enemy as ServerEnemy } from '@/spacetime/client';
import { EnemyHealthBar } from '../ui/enemy-health-bar';

interface InterpolationData {
  targetX: number;
  startX: number;
  startTime: number;
}

/**
 * Handles enemy movement interpolation and position updates
 */
export class EnemyMovementManager {
  private scene: Phaser.Scene;
  private enemyInterpolation = new Map<number, InterpolationData>();
  private interpolationDuration = 100; // 100ms to match server update frequency

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupInterpolationUpdate();
  }

  /**
   * Start interpolation for enemy movement
   */
  public startInterpolation(enemyId: number, currentX: number, targetX: number): void {
    if (Math.abs(targetX - currentX) > 0.1) {
      this.enemyInterpolation.set(enemyId, {
        targetX: targetX,
        startX: currentX,
        startTime: this.scene.time.now,
      });
    }
  }

  /**
   * Update enemy position and facing from server data
   */
  public updateEnemyPosition(
    serverEnemy: ServerEnemy,
    sprite: Phaser.Physics.Arcade.Sprite,
    healthBar?: EnemyHealthBar
  ): number {
    // Store previous position for movement detection
    const previousX = sprite.x;

    // Start interpolation to new X position
    this.startInterpolation(serverEnemy.enemyId, sprite.x, serverEnemy.x);

    // Update facing direction
    if (serverEnemy.facing.tag === 'Left') {
      sprite.setFlipX(true);
    } else {
      sprite.setFlipX(false);
    }

    // Update health bar position (will be interpolated in updateInterpolation)
    if (healthBar) {
      healthBar.updateHealth(serverEnemy.currentHp);
    }

    return previousX;
  }

  /**
   * Check if enemy is moving based on interpolation
   */
  public isEnemyMoving(enemyId: number, currentX: number, targetX: number): boolean {
    return Math.abs(targetX - currentX) > 0.1;
  }

  /**
   * Clean up interpolation data for an enemy
   */
  public clearInterpolation(enemyId: number): void {
    this.enemyInterpolation.delete(enemyId);
  }

  private setupInterpolationUpdate(): void {
    // Update interpolation every frame
    this.scene.events.on('update', () => {
      this.updateInterpolation();
    });
  }

  private updateInterpolation(): void {
    const currentTime = this.scene.time.now;

    for (const [enemyId, interpolationData] of this.enemyInterpolation.entries()) {
      // Get sprite and health bar from parent manager (will be injected)
      const updateCallback = this.interpolationCallbacks.get(enemyId);
      if (!updateCallback) continue;

      const elapsed = currentTime - interpolationData.startTime;
      const progress = Math.min(elapsed / this.interpolationDuration, 1);

      // Smooth interpolation using easeOutQuad
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const interpolatedX =
        interpolationData.startX +
        (interpolationData.targetX - interpolationData.startX) * easeProgress;

      // Update position through callback
      updateCallback(interpolatedX);

      // Clean up completed interpolations
      if (progress >= 1) {
        this.enemyInterpolation.delete(enemyId);
      }
    }
  }

  // Callback system to avoid circular dependencies
  private interpolationCallbacks = new Map<number, (x: number) => void>();

  public registerInterpolationCallback(enemyId: number, callback: (x: number) => void): void {
    this.interpolationCallbacks.set(enemyId, callback);
  }

  public unregisterInterpolationCallback(enemyId: number): void {
    this.interpolationCallbacks.delete(enemyId);
    this.enemyInterpolation.delete(enemyId);
  }

  public destroy(): void {
    this.scene.events.off('update', this.updateInterpolation, this);
    this.enemyInterpolation.clear();
    this.interpolationCallbacks.clear();
  }
}
