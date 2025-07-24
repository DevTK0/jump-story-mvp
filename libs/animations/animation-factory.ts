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
    constructor(message: string, public readonly context?: Record<string, any>) {
        super(message);
        this.name = 'AnimationError';
    }
}

export interface AnimationFrameConfig {
    start: number;
    end: number;
}

export interface AnimationConfig {
    key: string;
    spriteKey: string;
    frames: AnimationFrameConfig;
    frameRate: number;
    repeat: number;
    yoyo?: boolean;
    delay?: number;
}

export interface SpriteAnimationSet {
    idle: AnimationFrameConfig & { frameRate: number };
    walk: AnimationFrameConfig & { frameRate: number };
    attack1?: AnimationFrameConfig & { frameRate: number };
    attack2?: AnimationFrameConfig & { frameRate: number };
    attack3?: AnimationFrameConfig & { frameRate: number };
    hurt?: AnimationFrameConfig & { frameRate: number };
    damaged?: AnimationFrameConfig & { frameRate: number };
    death?: AnimationFrameConfig & { frameRate: number };
    [key: string]: (AnimationFrameConfig & { frameRate: number }) | undefined;
}

export type AnimationType =
    | "idle"
    | "walk"
    | "attack1"
    | "attack2"
    | "attack3"
    | "hurt"
    | "hit"
    | "death"
    | "damaged";

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
    public registerSpriteAnimations(
        spriteKey: string,
        animations: SpriteAnimationSet
    ): void {
        this.spriteDefinitions.set(spriteKey, animations);
    }

    /**
     * Create all animations for a registered sprite
     */
    public createSpriteAnimations(spriteKey: string): string[] {
        const animations = this.spriteDefinitions.get(spriteKey);
        if (!animations) {
            throw new AnimationError(
                `No animation definitions found for sprite: ${spriteKey}`,
                { spriteKey }
            );
        }

        const createdAnimationKeys: string[] = [];

        for (const [animationType, config] of Object.entries(animations)) {
            if (config) {
                const animationKey = this.generateAnimationKey(
                    spriteKey,
                    animationType
                );
                this.createSingleAnimation({
                    key: animationKey,
                    spriteKey,
                    frames: { start: config.start, end: config.end },
                    frameRate: config.frameRate,
                    repeat: this.getDefaultRepeatForAnimationType(
                        animationType
                    ),
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
            frames: this.scene.anims.generateFrameNumbers(
                config.spriteKey,
                config.frames
            ),
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
    public generateAnimationKey(
        spriteKey: string,
        animationType: string
    ): string {
        return `${spriteKey}-${animationType}-anim`;
    }

    /**
     * Get animation key for a specific sprite and animation type
     */
    public getAnimationKey(
        spriteKey: string,
        animationType: AnimationType
    ): string {
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
    public hasSpriteAnimation(
        spriteKey: string,
        animationType: AnimationType
    ): boolean {
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
     * Create a custom animation with validation and standardized naming
     */
    public createCustomAnimation(
        spriteKey: string,
        animationType: string,
        frames: AnimationFrameConfig,
        frameRate: number,
        repeat: number = -1,
        options?: { yoyo?: boolean; delay?: number }
    ): string {
        const key = this.generateAnimationKey(spriteKey, animationType);

        return this.createSingleAnimation({
            key,
            spriteKey,
            frames,
            frameRate,
            repeat,
            yoyo: options?.yoyo,
            delay: options?.delay,
        });
    }

    /**
     * Batch create animations from a configuration object
     */
    public createAnimationsFromConfig(
        spriteKey: string,
        configurations: Record<
            string,
            Omit<AnimationConfig, "key" | "spriteKey">
        >
    ): string[] {
        const createdKeys: string[] = [];

        for (const [animationType, config] of Object.entries(configurations)) {
            const key = this.generateAnimationKey(spriteKey, animationType);
            const fullConfig: AnimationConfig = {
                ...config,
                key,
                spriteKey,
            };

            this.createSingleAnimation(fullConfig);
            createdKeys.push(key);
        }

        return createdKeys;
    }

    /**
     * Get default repeat value based on animation type
     */
    private getDefaultRepeatForAnimationType(animationType: string): number {
        switch (animationType) {
            case "idle":
            case "walk":
                return -1; // Loop indefinitely
            case "attack1":
            case "attack2":
            case "attack3":
            case "hurt":
            case "hit":
            case "death":
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

    /**
     * Static helper to create pre-configured animation sets for common sprite types
     */
    public static createSoldierAnimations(): SpriteAnimationSet {
        return {
            idle: { start: 0, end: 5, frameRate: 8 },
            walk: { start: 9, end: 16, frameRate: 12 },
            attack1: { start: 18, end: 23, frameRate: 20 },
            attack2: { start: 27, end: 32, frameRate: 20 },
            attack3: { start: 36, end: 45, frameRate: 20 },
            hurt: { start: 45, end: 49, frameRate: 15 },
        };
    }

    public static createOrcAnimations(): SpriteAnimationSet {
        return {
            idle: { start: 0, end: 5, frameRate: 8 },
            walk: { start: 9, end: 16, frameRate: 10 },
            damaged: { start: 32, end: 36, frameRate: 15 },
        };
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
    public play(
        animationType: AnimationType,
        ignoreIfPlaying: boolean = true
    ): boolean {
        const spriteKey = this.sprite.texture.key;
        const animationKey = this.factory.getAnimationKey(
            spriteKey,
            animationType
        );

        if (!this.factory.hasAnimation(animationKey)) {
            console.warn(
                `Animation '${animationKey}' not found for sprite '${spriteKey}'`
            );
            return false;
        }

        if (
            ignoreIfPlaying &&
            this.currentAnimation === animationKey &&
            this.sprite.anims.isPlaying
        ) {
            return false;
        }

        this.sprite.play(animationKey);
        this.currentAnimation = animationKey;
        return true;
    }

    /**
     * Play animation by full key
     */
    public playByKey(
        animationKey: string,
        ignoreIfPlaying: boolean = true
    ): boolean {
        if (!this.factory.hasAnimation(animationKey)) {
            console.warn(`Animation '${animationKey}' not found`);
            return false;
        }

        if (
            ignoreIfPlaying &&
            this.currentAnimation === animationKey &&
            this.sprite.anims.isPlaying
        ) {
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
        const animationKey = this.factory.getAnimationKey(
            spriteKey,
            animationType
        );
        return (
            this.sprite.anims.isPlaying &&
            this.getCurrentAnimation() === animationKey
        );
    }
}
