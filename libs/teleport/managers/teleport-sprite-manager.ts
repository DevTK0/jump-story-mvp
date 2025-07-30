import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';

/**
 * Manages teleport stone sprites and their animations
 * Follows the pattern established by EnemySpawnManager
 */
export class TeleportSpriteManager {
  private scene: Phaser.Scene;
  private teleportSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private logger: ModuleLogger;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('TeleportSpriteManager');
  }

  /**
   * Create a teleport stone sprite at the specified location
   */
  public createTeleportStone(locationName: string, x: number, y: number): Phaser.GameObjects.Sprite {
    if (this.teleportSprites.has(locationName)) {
      this.logger.warn(`Teleport stone already exists for location: ${locationName}`);
      return this.teleportSprites.get(locationName)!;
    }

    // Create sprite centered on the teleport tile (tiles are 32x32)
    const sprite = this.scene.add.sprite(
      x + 16,
      y + 16,
      'teleport-stone',
      0
    );

    sprite.setDepth(1);
    sprite.setOrigin(0.5, 0.5);
    this.teleportSprites.set(locationName, sprite);
    
    this.logger.debug(`Created teleport stone at (${x + 16}, ${y + 16}) for location: ${locationName}`);
    
    return sprite;
  }

  /**
   * Remove a teleport stone sprite
   */
  public removeTeleportStone(locationName: string): void {
    const sprite = this.teleportSprites.get(locationName);
    if (sprite) {
      sprite.destroy();
      this.teleportSprites.delete(locationName);
      this.logger.debug(`Removed teleport stone for location: ${locationName}`);
    }
  }

  /**
   * Update the sprite frame and play unlock animation if needed
   */
  public updateTeleportSprite(locationName: string, isUnlocked: boolean): void {
    const sprite = this.teleportSprites.get(locationName);
    if (!sprite) {
      this.logger.warn(`Teleport sprite not found for location: ${locationName}`);
      return;
    }

    const currentFrame = sprite.frame.name;
    const targetFrame = isUnlocked ? 1 : 0;

    if (currentFrame !== targetFrame.toString()) {
      sprite.setFrame(targetFrame);
      
      if (isUnlocked) {
        this.playUnlockAnimation(sprite);
      }
    }
  }

  /**
   * Play unlock animation for a teleport stone
   */
  private playUnlockAnimation(sprite: Phaser.GameObjects.Sprite): void {
    // Scale animation
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 200,
      ease: 'Power2',
      yoyo: true,
      onComplete: () => {
        this.createUnlockParticles(sprite.x, sprite.y);
      },
    });

    // Flash effect
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0.3,
      duration: 100,
      ease: 'Power1',
      yoyo: true,
      repeat: 2,
    });
  }

  /**
   * Create particle effects for unlock animation
   */
  private createUnlockParticles(x: number, y: number): void {
    // Create simple sparkle effect using individual sprites
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 100 + Math.random() * 50;

      const particle = this.scene.add.sprite(x, y, 'teleport-stone', 1);
      particle.setScale(0.3);
      particle.setAlpha(1);
      particle.setBlendMode(Phaser.BlendModes.ADD);

      // Animate outward
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  /**
   * Get a teleport sprite by location name
   */
  public getTeleportSprite(locationName: string): Phaser.GameObjects.Sprite | null {
    return this.teleportSprites.get(locationName) || null;
  }

  /**
   * Get all teleport sprites
   */
  public getAllSprites(): Map<string, Phaser.GameObjects.Sprite> {
    return new Map(this.teleportSprites);
  }

  /**
   * Clean up all sprites
   */
  public destroy(): void {
    for (const sprite of this.teleportSprites.values()) {
      sprite.destroy();
    }
    this.teleportSprites.clear();
    this.logger.info('All teleport sprites destroyed');
  }
}