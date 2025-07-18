---
title: Stage
---

```d2
direction: right

MapLoader: {
  label: "MapLoader\n(Load & Process)"
}

MapData: {
  label: "MapData\n(Structured Container)"
}

PhysicsGroups: {
  label: "Physics Groups\n(Collision Bodies)"
}

GameScene: {
  label: "Game Scene\n(Phaser)"
}

TiledMapEditor: {
  label: "Tiled Map Editor\n(.tmj files)"
}

Tilemap: {
  label: "Tilemap\n(Visual Layers)"
}

# Asset Flow
TiledMapEditor -> MapLoader: provides .tmj files
MapLoader -> MapData: creates structured data
MapLoader -> PhysicsGroups: generates collision bodies
MapLoader -> Tilemap: creates visual layers

# Scene Integration
GameScene -> MapLoader: uses
MapLoader -> GameScene: returns MapData

# Data Structure
MapData -> PhysicsGroups: contains references
MapData -> Tilemap: contains tilemap object
```

## Overview

The stage system handles loading and processing of game levels from Tiled map editor files. The MapLoader loads tilemap assets and creates visual layers, physics bodies, and collision groups. MapData provides a structured container for all map-related data including ground, platforms, climbable areas, boundaries, and interactive objects. PhysicsGroups organize collision bodies by type with specific behaviors (solid terrain, one-way platforms, climbable areas, invisible barriers). The GameScene integrates with MapLoader to load complete level data during the create phase, enabling other game systems to interact with the environment.
