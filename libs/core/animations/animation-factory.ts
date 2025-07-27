/**
 * Standardized Animation Factory for managing Phaser animations across different sprite types
 *
 * This factory provides:
 * - Consistent animation creation patterns
 * - Standardized naming conventions
 * - Centralized configuration management
 * - Type-safe animation definitions
 * - Automatic animation registration and caching
 */

// Animation-specific error types
export class AnimationError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AnimationError';
  }
}

export interface AnimationFrameConfig {
  start: number;
  end: number;
  frameRate: number;
  duration?: number; // Optional duration in milliseconds
}

export interface AnimationConfig {
  key: string;
  spriteKey: string;
  frames: {
    start: number;
    end: number;
  };
  frameRate: number;
  repeat: number;
  yoyo?: boolean;
  delay?: number;
}

export interface SpriteAnimationSet {
  idle: AnimationFrameConfig;
  walk: AnimationFrameConfig;
  attack1?: AnimationFrameConfig;
  attack2?: AnimationFrameConfig;
  attack3?: AnimationFrameConfig;
  damaged?: AnimationFrameConfig;
  death?: AnimationFrameConfig;
  [key: string]: AnimationFrameConfig | undefined;
}

export type AnimationType =
  | 'idle'
  | 'walk'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'damaged'
  | 'hit'
  | 'death';

/**
 * Animation Factory for creating and managing standardized sprite animations
 */
export class AnimationFactory {
  private scene: Phaser.Scene;
  private registeredAnimations = new Map<string, AnimationConfig>();
  private spriteDefinitions = new Map<string, SpriteAnimationSet>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Register a sprite's animation definitions
   */
  public registerSpriteAnimations(spriteKey: string, animations: SpriteAnimationSet): void {
    this.spriteDefinitions.set(spriteKey, animations);
  }

  /**
   * Create all animations for a registered sprite
   */
  public createSpriteAnimations(spriteKey: string): string[] {
    const animations = this.spriteDefinitions.get(spriteKey);
    if (!animations) {
      throw new AnimationError(`No animation definitions found for sprite: ${spriteKey}`, {
        spriteKey,
      });
    }

    const createdAnimationKeys: string[] = [];

    for (const [animationType, config] of Object.entries(animations)) {
      if (config) {
        const animationKey = this.generateAnimationKey(spriteKey, animationType);
        this.createSingleAnimation({
          key: animationKey,
          spriteKey,
          frames: { start: config.start, end: config.end },
          frameRate: config.frameRate,
          repeat: this.getDefaultRepeatForAnimationType(animationType),
        });
        createdAnimationKeys.push(animationKey);
      }
    }

    return createdAnimationKeys;
  }

  /**
   * Create a single animation with the factory pattern
   */
  public createSingleAnimation(config: AnimationConfig): string {
    // Check if animation already exists
    if (this.scene.anims.exists(config.key)) {
      console.warn(`Animation '${config.key}' already exists, skipping creation`);
      return config.key;
    }

    // Create the Phaser animation
    this.scene.anims.create({
      key: config.key,
      frames: this.scene.anims.generateFrameNumbers(config.spriteKey, config.frames),
      frameRate: config.frameRate,
      repeat: config.repeat,
      yoyo: config.yoyo || false,
      delay: config.delay || 0,
    });

    // Store the configuration for future reference
    this.registeredAnimations.set(config.key, config);

    return config.key;
  }

  /**
   * Generate standardized animation key following the pattern: {spriteKey}-{animationType}-anim
   */
  public generateAnimationKey(spriteKey: string, animationType: string): string {
    return `${spriteKey}-${animationType}-anim`;
  }

  /**
   * Static helper to generate animation keys without factory instance
   */
  public static getAnimationKey(spriteKey: string, animationType: string): string {
    return `${spriteKey}-${animationType}-anim`;
  }

  /**
   * Get animation key for a specific sprite and animation type
   */
  public getAnimationKey(spriteKey: string, animationType: AnimationType): string {
    return this.generateAnimationKey(spriteKey, animationType);
  }

  /**
   * Check if an animation exists
   */
  public hasAnimation(key: string): boolean {
    return this.scene.anims.exists(key);
  }

  /**
   * Check if an animation exists for a specific sprite and type
   */
  public hasSpriteAnimation(spriteKey: string, animationType: AnimationType): boolean {
    const key = this.getAnimationKey(spriteKey, animationType);
    return this.hasAnimation(key);
  }

  /**
   * Get animation configuration by key
   */
  public getAnimationConfig(key: string): AnimationConfig | undefined {
    return this.registeredAnimations.get(key);
  }


  /**
   * Get default repeat value based on animation type
   */
  private getDefaultRepeatForAnimationType(animationType: string): number {
    switch (animationType) {
      case 'idle':
      case 'walk':
        return -1; // Loop indefinitely
      case 'attack1':
      case 'attack2':
      case 'attack3':
      case 'damaged':
      case 'hit':
      case 'death':
        return 0; // Play once
      default:
        return -1; // Default to loop
    }
  }

  /**
   * Get all registered animations
   */
  public getRegisteredAnimations(): Map<string, AnimationConfig> {
    return new Map(this.registeredAnimations);
  }

  /**
   * Get all sprite definitions
   */
  public getSpriteDefinitions(): Map<string, SpriteAnimationSet> {
    return new Map(this.spriteDefinitions);
  }

  /**
   * Clear all registered animations and sprite definitions
   */
  public clear(): void {
    this.registeredAnimations.clear();
    this.spriteDefinitions.clear();
  }

  /**
   * Remove a specific animation
   */
  public removeAnimation(key: string): boolean {
    if (this.scene.anims.exists(key)) {
      this.scene.anims.remove(key);
      this.registeredAnimations.delete(key);
      return true;
    }
    return false;
  }

}

/**
 * Animation Manager utility class for easier sprite animation management
 */
export class AnimationManager {
  private factory: AnimationFactory;
  private sprite: Phaser.GameObjects.Sprite;
  private currentAnimation: string | null = null;

  constructor(factory: AnimationFactory, sprite: Phaser.GameObjects.Sprite) {
    this.factory = factory;
    this.sprite = sprite;
  }

  /**
   * Play an animation by type, using the sprite's texture key
   */
  public play(animationType: AnimationType, ignoreIfPlaying: boolean = true): boolean {
    const spriteKey = this.sprite.texture.key;
    const animationKey = this.factory.getAnimationKey(spriteKey, animationType);

    if (!this.factory.hasAnimation(animationKey)) {
      console.warn(`Animation '${animationKey}' not found for sprite '${spriteKey}'`);
      return false;
    }

    if (ignoreIfPlaying && this.currentAnimation === animationKey && this.sprite.anims.isPlaying) {
      return false;
    }

    this.sprite.play(animationKey);
    this.currentAnimation = animationKey;
    return true;
  }


  /**
   * Stop current animation
   */
  public stop(): void {
    this.sprite.anims.stop();
    this.currentAnimation = null;
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
    const animationKey = this.factory.getAnimationKey(spriteKey, animationType);
    return this.sprite.anims.isPlaying && this.getCurrentAnimation() === animationKey;
  }
}
