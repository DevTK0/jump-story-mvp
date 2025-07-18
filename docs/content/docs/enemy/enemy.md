---
title: Enemy System
---

```d2
EnemyManager: {
  shape: rectangle
  "Spawns & manages enemies"
  "Handles lifecycle & cleanup"
  "Configurable spawn rates"
}

Enemy: {
  shape: rectangle
  "Individual enemy instance"
  "Tracks target movement"
  "Phaser physics sprite"
}

Constants: {
  shape: rectangle
  "Configuration values"
  "Speed, size, spawn rates"
  "Physics properties"
}

Target: {
  shape: rectangle
  "Player or trackable object"
  "Provides x, y coordinates"
}

EnemyManager -> Enemy: "Creates & destroys"
Enemy -> Target: "Tracks position"
EnemyManager -> Constants: "Uses spawn config"
Enemy -> Constants: "Uses behavior config"
```

## Enemy System Components

The enemy system consists of four main components that work together to create and manage enemies in the game:

**EnemyManager** - The central manager that handles enemy spawning, lifecycle management, and cleanup. It maintains a collection of active enemies and spawns new ones at configurable intervals from screen edges (top, left, right) while respecting maximum enemy limits.

**Enemy** - Individual enemy instances that extend Phaser's physics sprite system. Each enemy tracks a target (typically the player) and moves toward it when within tracking range. Enemies have configurable speed, size, color, and tracking behavior with distance-based speed optimization.

**Constants** - Configuration module containing all enemy-related constants including spawn rates, movement speeds, physics properties, and visual settings. This centralized configuration makes the system easily tunable.

**Target** - Any object that provides x and y coordinates for enemies to track. Currently implemented as Phaser GameObjects but designed to be flexible for different target types.