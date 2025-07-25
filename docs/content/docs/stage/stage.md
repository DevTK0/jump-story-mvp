---
title: Stage
---

```d2 layout="elk"
MapLoader: {
  shape: class
  loadMapAssets()
  createMap(): MapData
  createPhysicsFromGround(): StaticGroup
  createPhysicsFromPlatforms(): StaticGroup
  createClimbeablePhysics(): StaticGroup
  createBoundaryPhysics(): StaticGroup
}

STAGE_CONFIG: {
  shape: class
  world: (width, height)
  platform: (color, height, width)
  ground: (height)
  climbeable: (color, knotColor)
}

MapData: {
  shape: class
  ground: "MapGround[]"
  platforms: "MapPlatform[]"
  climbeable: "MapClimbeable[]"
  boundaries: "MapBoundary[]"
  chests: "MapChest[]"
  tilemap: Phaser.Tilemaps.Tilemap
}

MapLoader -> STAGE_CONFIG
MapLoader -> MapData
```

The Stage system handles Tiled map loading and physics setup for game levels. It provides a unified interface for loading map assets, creating collision boundaries, and integrating with game systems. The system supports different collision types including solid ground, one-way platforms, climbeable surfaces, and world boundaries.

## Components

### MapLoader

The core class responsible for loading Tiled maps and converting them into Phaser physics objects. Located in `stage/map-loader.ts`.

Key responsibilities:

- Load map assets (JSON and tilesets)
- Create Phaser tilemap from Tiled data
- Extract collision objects from map layers
- Generate physics groups with appropriate collision behaviors

### STAGE_CONFIG

Configuration object defining visual and physical properties for stage elements. Found in `stage/config.ts`.

### Data Interfaces

TypeScript interfaces defining the structure of map collision objects:

- `MapData` - Complete map data structure
- `MapGround` - Solid collision surfaces
- `MapPlatform` - One-way platforms
- `MapClimbeable` - Pass-through climbing areas
- `MapBoundary` - World boundaries
- `MapChest` - Interactive objects

## Usage

### Basic Integration

```ts
class YourScene extends Phaser.Scene {
  private mapLoader!: MapLoader;
  private mapData!: MapData;

  preload(): void {
    // Initialize and load map assets
    this.mapLoader = new MapLoader(this); // [!code ++]
    this.mapLoader.loadMapAssets(); // [!code ++]
  }

  create(): void {
    // Create map and extract collision data
    this.mapData = this.mapLoader.createMap(); // [!code ++]

    // Generate physics groups
    const groundGroup = this.mapLoader.createPhysicsFromGround(this.mapData.ground); // [!code ++]
    const platformGroup = this.mapLoader.createPhysicsFromPlatforms(this.mapData.platforms); // [!code ++]
    const climbeableGroup = this.mapLoader.createClimbeablePhysics(this.mapData.climbeable); // [!code ++]

    // Set up collisions with player
    this.physics.add.collider(this.player, groundGroup); // [!code ++]
    this.physics.add.collider(this.player, platformGroup, undefined, (player, platform) => {
      // [!code ++]
      // One-way platform logic // [!code ++]
      return player.body.velocity.y > 0 && player.body.y < platform.body.y; // [!code ++]
    }); // [!code ++]
  }
}
```

### Adding New Collision Types

```ts
// In map-loader.ts
private extractNewType(tilemap: Phaser.Tilemaps.Tilemap): MapNewType[] {
    const newObjects: MapNewType[] = [];
    const layer = tilemap.getObjectLayer("NewType"); // [!code ++]

    if (layer) { // [!code ++]
        layer.objects.forEach((obj) => { // [!code ++]
            if (obj.rectangle) { // [!code ++]
                newObjects.push({ // [!code ++]
                    x: obj.x!, // [!code ++]
                    y: obj.y!, // [!code ++]
                    width: obj.width!, // [!code ++]
                    height: obj.height!, // [!code ++]
                    name: obj.name || "NewType", // [!code ++]
                }); // [!code ++]
            } // [!code ++]
        }); // [!code ++]
    } // [!code ++]

    return newObjects; // [!code ++]
}
```

## Integration

```d2 layout="elk"
PlaygroundScene -> MapLoader: instantiates
MapLoader -> "Tiled JSON": loads
MapLoader -> "Physics Groups": creates
"Physics Groups" -> Player: collision
"Physics Groups" -> Enemy: collision
"Physics Groups" -> ClimbingSystem: overlap detection

PlaygroundScene: {
    preload()
    create()
}

MapLoader: {
    loadMapAssets()
    createMap()
    createPhysics*()
}

Player: {
    ClimbingSystem
    MovementSystem
    CombatSystem
}

Enemy: {
    EnemyManager
}
```

The Stage system integrates with multiple game systems:

- **PlaygroundScene**: Orchestrates the loading and setup process
- **Player Systems**: Receives collision groups for movement, climbing, and combat
- **Enemy Systems**: Uses same physics groups for consistent collision behavior
- **Climbing System**: Receives climbeable group for overlap detection

## Configuration

Current defaults in `STAGE_CONFIG`:

```ts
{
    world: {
        width: 800,
        height: 600,
    },
    platform: {
        color: 0x654321,
        height: 20,
        width: 100,
    },
    ground: {
        height: 50,
    },
    climbeable: {
        color: 0x8b4513,
        knotColor: 0x654321,
    },
}
```

- `world`: Default dimensions for physics world bounds
- `platform`: Visual styling for platform collision debugging
- `ground`: Height specification for ground collision areas
- `climbeable`: Color scheme for climbeable surface visualization
