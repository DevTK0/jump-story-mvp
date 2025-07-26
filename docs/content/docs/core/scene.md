---
title: Scene
---

```d2 layout="elk"

SceneInitializer: {
    shape: class
    +config: SceneConfig
    +loadAssets(): void
    +start(): Promise<void>
    +update(time, delta): void
    +shutdown(): void
    +getSystems(): InitializedSystems
}

ManagerRegistry: {
    shape: class
    +initialize(config): Promise<void>
    +setupPhysics(player, mapData): Promise<void>
    +update(time, delta): void
    +destroy(): void
    +getEnemyManager(): EnemyManager
    +getPeerManager(): PeerManager
    +getLevelUpAnimationManager(): LevelUpAnimationManager
    +getChatManager(): ChatManager
    +getEnemyDamageManager(): EnemyDamageRenderer
    +getPlayerDamageManager(): PlayerDamageRenderer
    +getPhysicsManager(): PhysicsSetupCoordinator
    +getInteractionManager(): InteractionHandler
}

SceneEvents: {
    shape: class
    +emitSceneEvent(scene, event, data): void
    +onSceneEvent(scene, event, fn): void
    +onceSceneEvent(scene, event, fn): void
    +offSceneEvent(scene, event, fn): void
}

SceneEventMap: {
    shape: class
    "player:attacked": AttackEventData
    "player:died": DeathEventData
}


SceneInitializer -> ManagerRegistry: creates
SceneInitializer -> SceneEvents: uses
ManagerRegistry -> "Game Managers": manages
SceneEvents -> SceneEventMap: types
```

The Scene system provides a comprehensive framework for managing Phaser scenes with type-safe events, organized initialization stages, and centralized manager lifecycle management.

## Components

### SceneInitializer

The main orchestrator for scene setup and lifecycle. It coordinates the initialization of all game systems in a specific order:

1. Debug/shadow state configuration
2. Animation creation
3. Map setup
4. Database connection
5. Player creation
6. Manager initialization
7. UI setup
8. Physics configuration
9. Optional debug features

### ManagerRegistry

Centralized registry for all game managers with lifecycle hooks. It manages:

- EnemyManager - Server-driven enemy spawning and management
- PeerManager - Multiplayer peer interpolation
- PhysicsManager - Physics setup coordination
- InteractionManager - Player-enemy interactions
- EnemyDamageManager - Enemy damage visual feedback
- PlayerDamageManager - Player damage visual feedback
- LevelUpAnimationManager - Level-up animations
- ChatManager - Chat functionality

### SceneEvents

Type-safe event system built on top of Phaser's event system. Provides compile-time type safety for scene events with TypeScript generics.

### SceneEventMap

Interface defining all available scene events and their data types. Currently supports:

- `player:attacked` - Emitted when player performs an attack
- `player:died` - Emitted when player dies

## Usage

### Basic Scene Setup

```ts
import { SceneInitializer, type SceneConfig } from '@/core/scene';

class GameScene extends Phaser.Scene {
  private initializer: SceneInitializer;

  constructor() {
    super({ key: 'GameScene' });

    const config: SceneConfig = {
      key: 'GameScene',
      player: {
        spawnX: 100,
        spawnY: 300,
        texture: 'player',
      },
      sprites: spriteConfig, // Required sprite configuration
      database: {
        target: 'local',
        moduleName: 'my-game',
      },
      debug: {
        enabled: true,
        shadow: true,
        invulnerable: false,
      },
    };

    this.initializer = new SceneInitializer(this, config);
  }

  preload() {
    this.initializer.loadAssets();
  }

  async create() {
    await this.initializer.start();
  }

  update(time: number, delta: number) {
    this.initializer.update(time, delta);
  }

  shutdown() {
    this.initializer.shutdown();
  }
}
```

### Using Scene Events

```ts
import { emitSceneEvent, onSceneEvent } from '@/core/scene';

// Emit a typed event
emitSceneEvent(scene, 'player:attacked', {
  type: 'melee',
  direction: 1,
  attackType: 1,
  damage: 10,
  critChance: 0.1,
});

// Listen for events with type-safe data
onSceneEvent(scene, 'player:died', (data) => {
  console.log(`Player died at ${data.position.x}, ${data.position.y}`);
});

// One-time listener
onceSceneEvent(scene, 'player:attacked', (data) => {
  console.log(`First attack was ${data.type}`);
});

// Remove listener
offSceneEvent(scene, 'player:died', myHandler);
```

### Accessing Managers

```ts
// Get systems after initialization
const systems = this.initializer.getSystems();
const { player, mapData, managers, ui, connection } = systems;

// Access specific managers
const enemyManager = managers.getEnemyManager();
const peerManager = managers.getPeerManager();
const chatManager = managers.getChatManager();
```

## Integration

```d2 layout="elk"
GameScene -> SceneInitializer: uses
SceneInitializer -> AssetLoaderService: loads assets
SceneInitializer -> ManagerRegistry: creates
SceneInitializer -> Player: creates
SceneInitializer -> UIFactory: creates
SceneInitializer -> SceneConnectionHelper: database connection

ManagerRegistry -> EnemyManager: manages
ManagerRegistry -> PeerManager: manages
ManagerRegistry -> PhysicsManager: manages
ManagerRegistry -> InteractionManager: manages
ManagerRegistry -> EnemyDamageManager: manages
ManagerRegistry -> PlayerDamageManager: manages
ManagerRegistry -> LevelUpAnimationManager: manages
ManagerRegistry -> ChatManager: manages

Player -> SceneEvents: emits events
Combat -> SceneEvents: emits attack events
AnimationSystem -> SceneEvents: listens for events
InteractionHandler -> SceneEvents: listens for events
```

## Configuration

### SceneConfig

```ts
interface SceneConfig {
  key: string; // Scene key identifier
  player?: {
    // Player spawn configuration
    spawnX: number; // Default: 0
    spawnY: number; // Default: 0
    texture: string; // Player texture key
  };
  database?: {
    // Database connection settings
    target?: 'local' | 'cloud'; // Default: 'local'
    moduleName?: string; // Default: 'jump-story'
  };
  debug?: {
    // Debug settings
    enabled: boolean; // Enable debug mode
    shadow?: boolean; // Enable shadow effects
    invulnerable?: boolean; // Prevent player damage
  };
  sprites?: SpriteConfig; // Required sprite configuration
}
```

### ManagerInitConfig

```ts
interface ManagerInitConfig {
  mapData: MapData; // Loaded map data
  player: Player; // Player instance
  connection: DbConnection; // Database connection (required)
  identity: Identity; // Player identity (required)
}
```
