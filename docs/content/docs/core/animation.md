---
title: Animation
---

```d2 layout="elk"
AnimationFactory: {
    shape: class
    scene: Phaser.Scene
    registeredAnimations: Map
    spriteDefinitions: Map
    registerSpriteAnimations(): void
    createSpriteAnimations(): "string[]"
    createSingleAnimation(): string
    generateAnimationKey(): string
    getAnimationKey(): string
    hasAnimation(): boolean
    removeAnimation(): boolean
}

AnimationManager: {
    shape: class
    factory: AnimationFactory
    sprite: Phaser.GameObjects.Sprite
    currentAnimation: string
    play(): boolean
    stop(): void
    isPlaying(): boolean
    getCurrentAnimation(): string
}

AnimationConfig: {
    shape: class
    key: string
    spriteKey: string
    frames: "{start, end}"
    frameRate: number
    repeat: number
    yoyo: boolean
    delay: number
}

AnimationFrameConfig: {
    shape: class
    start: number
    end: number
    frameRate: number
}

SpriteAnimationSet: {
    shape: class
    idle: AnimationFrameConfig
    walk: AnimationFrameConfig
    attack1?: AnimationFrameConfig
    attack2?: AnimationFrameConfig
    attack3?: AnimationFrameConfig
    damaged?: AnimationFrameConfig
    death?: AnimationFrameConfig
}

AnimationFactory -> AnimationConfig: creates
AnimationFactory -> SpriteAnimationSet: registers
SpriteAnimationSet -> AnimationFrameConfig: uses
AnimationManager -> AnimationFactory: uses
AnimationManager -> Phaser.GameObjects.Sprite: controls
```

The Animation module provides a standardized factory pattern for creating and managing Phaser animations across different sprite types. It ensures consistent animation key generation, centralized configuration management, and type-safe animation definitions with automatic registration and caching.

## Components

### AnimationFactory

The core factory class that manages animation creation and registration:

- **Standardized Key Generation**: Creates animation keys following `{spriteKey}-{animationType}-anim` pattern
- **Sprite Definition Registration**: Stores animation configurations for each sprite type
- **Batch Animation Creation**: Creates all animations for a sprite from its definition set
- **Animation Validation**: Checks for existing animations before creation
- **Static Helper Methods**: Provides `getAnimationKey()` for key generation without factory instance

### AnimationManager

A utility class for managing animations on individual sprites:

- **Simplified Animation Control**: Play animations by type using the sprite's texture key
- **Current Animation Tracking**: Maintains state of the currently playing animation
- **Play State Management**: Prevents redundant animation restarts with `ignoreIfPlaying` option
- **Type-Safe Animation Playback**: Uses AnimationType enum for animation selection

### Type Definitions

#### AnimationConfig

Defines the structure for creating a single animation with all Phaser animation options.

#### AnimationFrameConfig

Specifies the frame range for an animation sequence.

#### SpriteAnimationSet

Defines all available animations for a sprite type with their frame configurations.

#### AnimationType

Type union of all standard animation types: `idle`, `walk`, `attack1`, `attack2`, `attack3`, `damaged`, `hit`, `death`.

## Usage

### Creating Animations at Scene Level

```typescript
// In scene initialization
const animFactory = new AnimationFactory(scene);

// Register sprite animations
animFactory.registerSpriteAnimations('soldier', {
  idle: { start: 0, end: 5, frameRate: 8 },
  walk: { start: 9, end: 16, frameRate: 12 },
  attack1: { start: 18, end: 23, frameRate: 20 },
  attack2: { start: 27, end: 32, frameRate: 20 },
  attack3: { start: 36, end: 45, frameRate: 20 },
  damaged: { start: 45, end: 49, frameRate: 15 },
});

// Create all animations for the sprite
const createdKeys = animFactory.createSpriteAnimations('soldier');
```

### Managing Sprite Animations

```typescript
// Create animation manager for a sprite
const animManager = new AnimationManager(animFactory, sprite);

// Play animations by type
animManager.play('idle'); // Uses sprite's texture key
animManager.play('attack1', false); // Don't ignore if playing

// Check animation state
if (animManager.isPlaying('walk')) {
  console.log('Player is walking');
}

// Stop current animation
animManager.stop();
```

### Static Key Generation

```typescript
// Generate animation keys without factory instance
import { AnimationFactory } from '@/animations';

const idleKey = AnimationFactory.getAnimationKey('orc', 'idle');
// Returns: "orc-idle-anim"

// Check if animation exists before playing
if (scene.anims.exists(idleKey)) {
  sprite.play(idleKey);
}
```

## Integration

```d2 layout="elk"
AssetLoaderService: {
  Loads sprite PNGs
  Creates all animations
}

SpriteConfigLoader: {
  "Reads sprite-config.json"
  Provides frame definitions
}

AnimationFactory: {
  Registers animations
  Creates Phaser animations
}

Player: {
  PlayerAnimationManager
  AnimationSystem
}

Enemy: {
  State-based animations
  Direct sprite control
}

Peer: {
  State-based animations
  Direct sprite control
}

AssetLoaderService -> SpriteConfigLoader: reads frame data
SpriteConfigLoader -> AnimationFactory: provides definitions
AnimationFactory -> Phaser.AnimationManager: creates animations
Player -> PlayerAnimationManager: uses
Enemy -> Phaser.AnimationManager: plays directly
Peer -> Phaser.AnimationManager: plays directly
PlayerAnimationManager -> AnimationFactory: static key generation
```

### Animation System Architecture

**Local Player:**

- Uses dedicated `AnimationSystem` with `PlayerAnimationManager`
- Complex animation logic considering multiple inputs (state, velocity, events)
- Frame-by-frame animation decisions for responsiveness

**Enemies and Peers (Remote Players):**

- Use state-based animations where states directly control animations
- Simple 1:1 mapping between state and animation
- States call `sprite.play()` directly in their `onEnter()` methods
- Both use movement interpolation for smooth visual updates

## Configuration

### Animation Frame Definitions

Animation frames are defined in `sprite-config.json`:

```json
{
  "sprites": {
    "characters": {
      "soldier": {
        "animations": {
          "idle": { "start": 0, "end": 5, "frameRate": 8 },
          "walk": { "start": 9, "end": 16, "frameRate": 12 },
          "attack1": { "start": 18, "end": 23, "frameRate": 20 },
          "damaged": { "start": 45, "end": 49, "frameRate": 15 }
        }
      }
    }
  }
}
```

### Default Repeat Values

The factory automatically assigns repeat values based on animation type:

- **Looping Animations** (`-1`): `idle`, `walk`
- **One-shot Animations** (`0`): `attack1`, `attack2`, `attack3`, `damaged`, `hit`, `death`

### Animation Key Pattern

All animations follow the standardized pattern:

```
{spriteKey}-{animationType}-anim
```

Examples:

- `soldier-idle-anim`
- `orc-walk-anim`
- `enemy-patrol-anim`
