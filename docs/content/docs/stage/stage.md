---
title: Stage System
---

## Architecture Overview

```d2
direction: right
MapLoader: {
  loadMapAssets()
  createMap()
  createPhysicsFromGround()
  createPhysicsFromPlatforms()
  createClimbeablePhysics()
  createBoundaryPhysics()
}

MapData: {
  ground: MapGround
  platforms: MapPlatform
  climbeable: MapClimbeable
  boundaries: MapBoundary
  chests: MapChest
  tilemap: Tilemap
}

MapLoader -> MapData: creates

GameScene: {
  mapLoader: MapLoader
  mapData: MapData
}

GameScene -> MapLoader: uses

TiledMapEditor -> MapLoader: .tmj files

MapLoader -> PhysicsGroups: creates
PhysicsGroups: {
  GroundGroup
  PlatformGroup
  ClimbeableGroup
  BoundaryGroup
}

```

## Component Explanation

### MapLoader

The central class responsible for loading and creating game maps. It handles:

-   Loading tilemap assets (.tmj files) and tileset images from the Tiled map editor
-   Creating visual layers from the tilemap data
-   Extracting collision objects from map layers
-   Generating physics bodies with appropriate collision properties

### MapData

A structured container that holds all map-related data after processing:

-   **ground**: Solid collision areas that block movement from all directions
-   **platforms**: One-way platforms that only collide from above
-   **climbeable**: Areas where players can climb (overlap detection only)
-   **boundaries**: Invisible walls that prevent players from leaving the map
-   **chests**: Interactive objects with custom properties
-   **tilemap**: The Phaser tilemap object for rendering

### Physics Groups

Each map element type gets its own static physics group with specific collision behaviors:

-   **GroundGroup**: Full collision from all directions (solid terrain)
-   **PlatformGroup**: One-way collision (only from above)
-   **ClimbeableGroup**: No collision, only overlap detection
-   **BoundaryGroup**: Full collision but invisible barriers

### Integration Flow

1. GameScene initializes MapLoader in the preload phase
2. MapLoader loads the tilemap JSON and tileset images
3. During create phase, MapLoader processes the tilemap to extract collision data
4. Physics bodies are created for each element type with appropriate collision rules
5. The complete MapData structure is returned for use by other game systems
