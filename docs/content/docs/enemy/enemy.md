---
title: Enemy
---

```d2
direction: right

EnemyManager: {
  label: "EnemyManager\n(Spawn & Lifecycle)"
}

Enemy: {
  label: "Enemy\n(Individual Instance)"
}

Constants: {
  label: "Constants\n(Configuration)"
}

Target: {
  label: "Target\n(Player/Trackable)"
}

GameScene: {
  label: "Game Scene\n(Phaser)"
}

PhysicsGroup: {
  label: "Physics Group\n(Object Pool)"
}

# Management Flow
GameScene -> EnemyManager: creates
EnemyManager -> PhysicsGroup: uses for pooling
EnemyManager -> Enemy: spawns & destroys
EnemyManager -> Constants: reads spawn config

# Enemy Behavior
Enemy -> Target: tracks position
Enemy -> Constants: uses movement config

# Targeting
Target -> Enemy: provides coordinates
```

## Overview

The enemy system manages hostile entities that track and pursue the player. The EnemyManager handles spawning, lifecycle management, and cleanup of enemies using object pooling. Individual Enemy instances extend Phaser's physics sprite system and track targets with configurable movement behavior. The Constants module provides centralized configuration for spawn rates, movement speeds, and physics properties. The Target represents any trackable object (typically the player) that provides position coordinates for enemies to pursue.