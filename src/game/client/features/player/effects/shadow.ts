import type { TrajectoryPoint } from '../../debug/debug-interfaces';
import { DEBUG_CONFIG } from '../../debug/config';

/**
 * Manages shadow sprite rendering for movement trajectory visualization
 * Extracted from MovementSystem to follow Single Responsibility Principle
 */
export class ShadowTrajectoryRenderer {
  private scene: Phaser.Scene;
  private shadowSprites: Phaser.GameObjects.Sprite[] = [];
  private trajectoryPoints: TrajectoryPoint[] = [];
  private frameCounter = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Sample a trajectory point at the current position
   */
  sampleTrajectory(
    time: number,
    x: number,
    y: number,
    texture: string,
    frame: string | number,
    flipX: boolean,
    scaleX: number,
    scaleY: number
  ): void {
    this.frameCounter++;

    // Sample at reduced rate for performance
    if (this.frameCounter % DEBUG_CONFIG.trajectory.sampleRate !== 0) {
      return;
    }

    const point: TrajectoryPoint = {
      x,
      y,
      timestamp: time,
      texture,
      frame,
      flipX,
      scaleX,
      scaleY,
    };

    this.trajectoryPoints.push(point);

    // Remove old points to maintain circular buffer
    if (this.trajectoryPoints.length > DEBUG_CONFIG.trajectory.maxPoints) {
      this.trajectoryPoints.shift();
    }
  }

  /**
   * Render shadow sprites for trajectory visualization
   */
  render(): void {
    if (this.trajectoryPoints.length === 0) return;

    // Clean up old shadow sprites
    this.cleanupSprites();

    // Create shadow sprites for trajectory points
    for (
      let i = 0;
      i < this.trajectoryPoints.length;
      i += DEBUG_CONFIG.trajectory.shadowSkipRate
    ) {
      const point = this.trajectoryPoints[i];

      // Calculate fade based on age
      const age =
        (this.trajectoryPoints.length - i) / this.trajectoryPoints.length;
      const [minAlpha, maxAlpha] = DEBUG_CONFIG.trajectory.shadowAlphaRange;
      const alpha = minAlpha + age * (maxAlpha - minAlpha);

      // Create shadow sprite
      const shadowSprite = this.scene.add.sprite(
        point.x,
        point.y,
        point.texture,
        point.frame
      );
      shadowSprite.setFlipX(point.flipX);
      shadowSprite.setScale(point.scaleX, point.scaleY);
      shadowSprite.setAlpha(alpha);
      shadowSprite.setTint(DEBUG_CONFIG.trajectory.shadowTint);
      shadowSprite.setDepth(-1); // Behind other sprites

      this.shadowSprites.push(shadowSprite);
    }
  }

  /**
   * Clean up all shadow sprites
   */
  cleanupSprites(): void {
    this.shadowSprites.forEach((sprite) => sprite.destroy());
    this.shadowSprites = [];
  }

  /**
   * Clear trajectory points
   */
  clearTrajectory(): void {
    this.trajectoryPoints = [];
  }

  /**
   * Get current trajectory point count
   */
  getTrajectoryPointCount(): number {
    return this.trajectoryPoints.length;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.cleanupSprites();
    this.clearTrajectory();
  }
}