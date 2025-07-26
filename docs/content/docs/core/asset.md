---
title: Asset
---

```d2 layout="elk"
AssetLoaderService: {
    shape: class
    +constructor(scene, spriteConfig)
    +loadSceneAssets()
    +createMap(): MapData
    +createAllAnimations()
    -loadMapAssets()
    -loadSpriteSheets()
    -loadEmotes()
    -mapLoader: MapLoader
}

MapLoader: {
    shape: class
    +constructor(scene)
    +loadMapAssets()
    +createMap(): MapData
}

AssetResolver: {
    shape: class
    +getAssetPath(path): string
    +getMapPath(file): string
}

SpriteConfigLoader: {
    shape: class
    +setConfig(config)
    +getSpriteDefinition(category, key): SpriteDefinition
    +loadAllSprites(scene)
    +loadSpritesForCategory(scene, category)
    +getAllAnimationDefinitions(): Record
    +validateSpritePaths(): "string[]"
}

SceneInitializer: {
    shape: class
}

AnimationFactory: {
    shape: class
}

ErrorBoundary: {
    shape: class
}

SceneInitializer -> AssetLoaderService: passes spriteConfig
AssetLoaderService -> MapLoader: creates and delegates to
AssetLoaderService -> AssetResolver: uses
AssetLoaderService -> SpriteConfigLoader: uses
AssetLoaderService -> AnimationFactory: uses
AssetLoaderService -> ErrorBoundary: uses
SpriteConfigLoader -> AssetResolver: uses
MapLoader -> AssetResolver: uses
```

The asset system manages loading and organization of game resources including sprites, tilemaps, and animations. It provides dynamic sprite loading from configuration, environment-aware path resolution, and centralized asset management for Phaser scenes.

## Components

### AssetLoaderService

The main orchestrator for asset loading in a scene. Coordinates loading of tilemaps, sprites, and emotes, then creates animations from loaded assets.

**Key features:**

- Accepts sprite configuration via constructor injection
- Dynamically loads all sprites from configuration categories
- Owns and delegates map operations to MapLoader instance
- Creates animations using AnimationFactory
- Handles asset loading errors via ErrorBoundary

### AssetResolver

A static utility providing centralized path resolution based on Vite's configuration.

**Key features:**

- Environment-aware path resolution using Vite's BASE_URL
- Separate methods for assets and maps
- Works with Vite's root configuration (no manual app setting)
- Zero dependencies

### SpriteConfigLoader

Manages sprite configurations and loading. Handles sprite definitions including paths, frame dimensions, and animation sequences.

**Key features:**

- Dynamic sprite loading by category
- Animation definition extraction
- Path security validation
- Duplicate loading prevention
- Singleton instance available

### MapLoader

Specialized component for loading and creating tilemaps. Handles all tilemap-related operations including asset loading and collision object extraction.

**Key features:**

- Loads tilemap JSON and tileset images
- Creates Phaser tilemap with multiple layers
- Extracts collision objects from map layers (ground, platforms, climbeable, boundaries, chests)
- Returns structured MapData with collision objects
- Uses AssetResolver for environment-aware path resolution

## Usage

### Creating a Scene with Assets

```ts
import { SceneInitializer, type SceneConfig } from '@/core';
import spriteConfig from '../config/sprite-config';

const sceneConfig: SceneConfig = {
  key: 'my-scene',
  player: {
    spawnX: 100,
    spawnY: 200,
    texture: 'soldier',
  },
  sprites: spriteConfig, // Required for asset loading // [!code ++]
};

export class MyScene extends Phaser.Scene {
  private initializer: SceneInitializer;

  constructor() {
    super({ key: 'my-scene' });
    this.initializer = new SceneInitializer(this, sceneConfig);
  }

  preload(): void {
    this.initializer.loadAssets(); // Loads all assets
  }

  async create(): Promise<void> {
    await this.initializer.start(); // Creates map and animations
  }
}
```

### Adding New Sprites

```ts
// In your sprite-config.ts
const spriteConfig: SpriteConfig = {
  sprites: {
    classes: {
      soldier: {
        /* existing */
      },
      wizard: {
        // [!code ++]
        path: 'assets/spritesheet/classes/Wizard.png', // [!code ++]
        frameWidth: 100, // [!code ++]
        frameHeight: 100, // [!code ++]
        animations: {
          // [!code ++]
          idle: { start: 0, end: 5, frameRate: 8 }, // [!code ++]
          walk: { start: 9, end: 16, frameRate: 12 }, // [!code ++]
          attack1: { start: 18, end: 22, frameRate: 10 }, // [!code ++]
        }, // [!code ++]
      }, // [!code ++]
    },
  },
};
```

## Integration

```d2 layout="elk"
SceneInitializer -> AssetLoaderService: passes spriteConfig
AssetLoaderService -> MapLoader: owns instance, delegates map operations
AssetLoaderService -> SpriteConfigLoader: loads sprites by category
AssetLoaderService -> AnimationFactory: creates animations

MapLoader -> AssetResolver: resolves tilemap and tileset paths
SpriteConfigLoader -> AssetResolver: resolves sprite paths
AssetLoaderService -> ErrorBoundary: reports errors
```

## Configuration

### Sprite Configuration Structure

The sprite configuration uses TypeScript for type safety:

```ts
{
  sprites: {
    classes: Record<string, SpriteDefinition>,
    enemies: Record<string, SpriteDefinition>,
    emotes: Record<string, SpriteDefinition>
  }
}
```

### SpriteDefinition Interface

Each sprite requires:

- `path`: Asset path relative to public directory
- `frameWidth`: Sprite frame width in pixels
- `frameHeight`: Sprite frame height in pixels
- `animations`: Animation definitions (varies by sprite type)

### Animation Types

**Character sprites** (classes/enemies):

- `idle`, `walk`, `attack1`, `attack2`, `attack3`, `damaged`, `death`

**Emote sprites**:

- `play` animation only

### Environment Configuration

- **Development**: BASE_URL = '/' (Vite dev server)
- **Production**: BASE_URL = '/jump-story-mvp/' (from Vite config)
- **App root**: Determined by Vite's root config (currently 'apps/playground')
