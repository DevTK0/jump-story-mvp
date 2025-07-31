import type { Scene } from 'phaser';
import type { SpriteAnimationSet, AnimationFrameConfig } from '../animations/animation-factory';
import { AssetResolver } from './asset-resolver';

// Flexible animation type that supports both regular sprites and emotes
export type FlexibleAnimationSet = SpriteAnimationSet | {
  play: AnimationFrameConfig & { frameRate: number };
  [key: string]: (AnimationFrameConfig & { frameRate: number }) | undefined;
};

export interface SpriteDefinition {
  path: string;
  frameWidth: number;
  frameHeight: number;
  animations: FlexibleAnimationSet;
  scale?: number; // Optional scale for the sprite
}

export interface SpriteConfig {
  sprites: {
    jobs?: Record<string, SpriteDefinition>;
    enemies?: Record<string, SpriteDefinition>;
    emotes?: Record<string, SpriteDefinition>;
    icons?: Record<string, SpriteDefinition>;
    [category: string]: Record<string, SpriteDefinition> | undefined;
  };
}

/**
 * Utility class for loading sprite configurations dynamically
 */
export class SpriteConfigLoader {
  private config: SpriteConfig | null = null;
  private loadedSprites = new Set<string>();

  /**
   * Load sprite configuration from a JSON file or object
   */
  public async loadConfig(configPath: string | SpriteConfig): Promise<void> {
    if (typeof configPath === 'string') {
      // In a real implementation, this would fetch from the configPath
      // For now, we'll require the config to be passed as an object
      throw new Error('Loading from path not implemented. Pass config object directly.');
    } else {
      this.config = configPath;
    }
  }

  /**
   * Set config directly (useful for importing JSON)
   */
  public setConfig(config: SpriteConfig): void {
    this.config = config;
  }

  /**
   * Get sprite definition by key and category
   */
  public getSpriteDefinition(category: string, spriteKey: string): SpriteDefinition | null {
    if (!this.config?.sprites[category]) {
      console.warn(`Category '${category}' not found in sprite config`);
      return null;
    }

    const sprite = this.config.sprites[category][spriteKey];
    if (!sprite) {
      console.warn(`Sprite '${spriteKey}' not found in category '${category}'`);
      return null;
    }

    return sprite;
  }

  /**
   * Load all sprites in the config into the scene
   */
  public loadAllSprites(scene: Scene): void {
    if (!this.config) {
      console.error('No sprite config loaded');
      return;
    }

    for (const [_category, sprites] of Object.entries(this.config.sprites)) {
      if (sprites) {
        for (const [spriteKey, definition] of Object.entries(sprites)) {
          this.loadSprite(scene, spriteKey, definition);
        }
      }
    }
  }

  /**
   * Load sprites for a specific category
   */
  public loadSpritesForCategory(scene: Scene, category: string): void {
    if (!this.config?.sprites[category]) {
      console.warn(`Category '${category}' not found in sprite config`);
      return;
    }

    const sprites = this.config.sprites[category];
    for (const [spriteKey, definition] of Object.entries(sprites)) {
      this.loadSprite(scene, spriteKey, definition);
    }
  }

  /**
   * Load a specific sprite
   */
  public loadSprite(scene: Scene, spriteKey: string, definition: SpriteDefinition): void {
    if (this.loadedSprites.has(spriteKey)) {
      return;
    }

    scene.load.spritesheet(spriteKey, AssetResolver.getAssetPath(definition.path), {
      frameWidth: definition.frameWidth,
      frameHeight: definition.frameHeight,
    });

    this.loadedSprites.add(spriteKey);
  }

  /**
   * Get all animation definitions for the AnimationFactory
   */
  public getAllAnimationDefinitions(): Record<string, FlexibleAnimationSet> {
    if (!this.config) {
      console.error('No sprite config loaded');
      return {};
    }

    const animations: Record<string, FlexibleAnimationSet> = {};

    for (const sprites of Object.values(this.config.sprites)) {
      if (sprites) {
        for (const [spriteKey, definition] of Object.entries(sprites)) {
          animations[spriteKey] = definition.animations;
        }
      }
    }

    return animations;
  }

  /**
   * Get animation definition for a specific sprite
   */
  public getAnimationDefinition(spriteKey: string): FlexibleAnimationSet | null {
    if (!this.config) {
      console.error('No sprite config loaded');
      return null;
    }

    // Search all categories for the sprite
    for (const sprites of Object.values(this.config.sprites)) {
      if (sprites && sprites[spriteKey]) {
        return sprites[spriteKey].animations;
      }
    }

    return null;
  }


  /**
   * Validate sprite paths exist (security check)
   */
  public validateSpritePaths(): string[] {
    const invalidPaths: string[] = [];

    if (!this.config) return invalidPaths;

    for (const sprites of Object.values(this.config.sprites)) {
      if (sprites) {
        for (const [spriteKey, definition] of Object.entries(sprites)) {
          // Basic path validation
          if (
            definition.path.includes('..') ||
            definition.path.includes('~') ||
            !definition.path.endsWith('.png')
          ) {
            invalidPaths.push(`${spriteKey}: ${definition.path}`);
          }
        }
      }
    }

    return invalidPaths;
  }

  /**
   * Get all available sprite keys
   */
  public getAvailableSprites(): { category: string; sprites: string[] }[] {
    if (!this.config) return [];

    const available: { category: string; sprites: string[] }[] = [];

    for (const [category, sprites] of Object.entries(this.config.sprites)) {
      if (sprites) {
        available.push({
          category,
          sprites: Object.keys(sprites),
        });
      }
    }

    return available;
  }
}

// Singleton instance
export const spriteConfigLoader = new SpriteConfigLoader();
