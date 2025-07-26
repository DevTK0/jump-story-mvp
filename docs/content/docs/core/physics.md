---
title: Physics
---

```d2 layout="elk"

  # Core Components
  PhysicsSetupCoordinator: {
    shape: class
    getRegistry()
    registerCollisionGroups()
    registerEntity()
    setupAllPhysics()
    cleanup()
  }

  PhysicsRegistry: {
    shape: class
    registerGroup(name, group)
    getGroup(name)
    addCollider()
    addOverlap()
    createOneWayPlatformCallback()
  }

  # Entity Contract
  PhysicsEntity: {
    shape: class
    setupPhysics(registry)
    getPhysicsBody()?
    cleanupPhysics()?
  }

  # Map-based Physics
  MapPhysicsFactory: {
    shape: class
    createPhysicsFromGround()
    createPhysicsFromPlatforms()
    createClimbeablePhysics()
    createBoundaryPhysics()
    createAllCollisionGroups()
  }

  # Dynamic Groups
  DynamicPhysicsGroup: {
    shape: class
    setLifecycleCallbacks()
    add()
    remove()
    clear()
    getGroup()
  }

  # Example Entities
  Player: {
    shape: class
    implements PhysicsEntity
  }

  EnemyManager: {
    shape: class
    implements PhysicsEntity
  }

  PeerManager: {
    shape: class
    implements PhysicsEntity
  }

  # Flow relationships
  Scene -> PhysicsSetupCoordinator: "creates"
  MapLoader -> MapPhysicsFactory: "provides map data"
  MapPhysicsFactory -> PhysicsSetupCoordinator: "collision groups"

  PhysicsSetupCoordinator -> PhysicsRegistry: "owns"
  PhysicsSetupCoordinator -> Player: "registers"
  PhysicsSetupCoordinator -> EnemyManager: "registers"
  PhysicsSetupCoordinator -> PeerManager: "registers"
  PhysicsSetupCoordinator -> PhysicsEntity: "calls setupPhysics()"

  Player -> PhysicsRegistry: "adds colliders"
  Player -> DynamicPhysicsGroup: "uses for projectiles"
  
  EnemyManager -> PhysicsRegistry: "adds colliders"
  EnemyManager -> DynamicPhysicsGroup: "uses for enemies"
  
  PeerManager -> PhysicsRegistry: "adds colliders"
  PeerManager -> DynamicPhysicsGroup: "uses for peers"

  DynamicPhysicsGroup -> PhysicsRegistry: "registers group"
  PhysicsRegistry -> "Phaser.Physics": "configures"

```

The Physics System provides a decentralized architecture for managing physics interactions in the game. Entities implement the PhysicsEntity interface to register their own collision and overlap relationships, while the PhysicsSetupCoordinator orchestrates the initialization process. The system uses Phaser's Arcade Physics engine and supports both static terrain collisions and dynamic entity groups.

## Components

### PhysicsEntity Interface

- Defines contract for entities that need physics interactions
- Entities implement `setupPhysics()` to register their collision/overlap handlers
- Optional methods for getting physics body and cleanup

### PhysicsRegistry

- Central registry for collision groups (ground, platforms, boundaries, etc.)
- Provides helper methods for adding colliders and overlaps
- Tracks registered entities for lifecycle management

### PhysicsSetupCoordinator

- Manages the physics initialization lifecycle
- Registers collision groups from map data
- Calls `setupPhysics()` on all registered entities
- Handles cleanup when scene shuts down

### MapPhysicsFactory

- Creates physics bodies from map data (JSON)
- Generates static groups for terrain elements:
  - Ground: Solid collision from all directions
  - Platforms: One-way collision (only from above)
  - Climbeable: Pass-through with overlap detection
  - Boundaries: Solid walls to prevent leaving map

### DynamicPhysicsGroup

- Wrapper for groups with changing membership (enemies, projectiles)
- Triggers callbacks when members are added/removed
- Ensures physics relationships are maintained

## Usage

### Implementing PhysicsEntity

```ts
import type { PhysicsEntity, PhysicsRegistry } from '@/core/physics';

export class Player extends Phaser.GameObjects.Sprite implements PhysicsEntity {
  setupPhysics(registry: PhysicsRegistry): void {
    // Add collision with ground
    registry.addCollider(this, 'ground');

    // Add one-way collision with platforms
    registry.addCollider(this, 'platforms', undefined, registry.createOneWayPlatformCallback());

    // Add overlap with enemies
    registry.addOverlap(this, 'enemies', this.handleEnemyOverlap, undefined, this);
  }

  private handleEnemyOverlap(player: any, enemy: any): void {
    // Handle collision logic
  }
}
```

### Setting Up Physics in Scene

```ts
// In scene initialization
const coordinator = new PhysicsSetupCoordinator(scene);

// Create collision groups from map
const mapData = await mapLoader.loadMap('level1');
const collisionGroups = MapPhysicsFactory.createAllCollisionGroups(scene, mapData);

// Register groups with coordinator
coordinator.registerCollisionGroups(collisionGroups);

// Register entities
coordinator.registerEntity(player);
coordinator.registerEntity(enemyManager);

// Initialize all physics
coordinator.setupAllPhysics();
```

### Using DynamicPhysicsGroup

```ts
const enemyGroup = new DynamicPhysicsGroup(scene, {
  classType: Enemy,
  maxSize: 50,
});

// Set lifecycle callbacks
enemyGroup.setLifecycleCallbacks(
  (enemy) => {
    // Called when enemy added
    registry.addCollider(enemy, 'ground');
  },
  (enemy) => {
    // Called when enemy removed
  }
);

// Register the group
registry.registerGroup('enemies', enemyGroup.getGroup());
```

## Integration

```d2 layout="elk"
Scene -> PhysicsSetupCoordinator: creates
MapLoader -> MapPhysicsFactory: provides map data
MapPhysicsFactory -> CollisionGroups: creates

PhysicsSetupCoordinator -> CollisionGroups: registers
PhysicsSetupCoordinator -> Player: registers
PhysicsSetupCoordinator -> EnemyManager: registers

Player -> PhysicsRegistry: setupPhysics
EnemyManager -> PhysicsRegistry: setupPhysics
PhysicsRegistry -> "Phaser.Physics": configures

Combat -> PhysicsRegistry: adds attack overlaps
Climbing -> PhysicsRegistry: uses climbeable group
```

## Configuration

### Collision Group Names

- `ground` - Solid terrain with full collision
- `platforms` - One-way platforms (jump through)
- `climbeable` - Ladders and vines (overlap only)
- `boundaries` - Map edges and walls
- `enemies` - Enemy collision group
- `player` - Player collision group

### Physics Settings

Default Phaser Arcade Physics configuration:

- Gravity Y: 800 (defined in scene)
- Debug rendering: Controlled by debug system
- Collision precision: Default Arcade Physics

### Required Groups

The PhysicsSetupCoordinator expects these groups to exist:

- `ground`
- `platforms`
- `boundaries`

Missing groups will log warnings but won't prevent initialization.
