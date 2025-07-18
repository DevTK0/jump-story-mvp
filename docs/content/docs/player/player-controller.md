---
title: Player Controller
---

```d2
direction: right

Player: {
  label: "Player Entity\n(Central Coordinator)"
}

InputSystem: {
  label: "Input System\n(Keyboard Processing)"
}

MovementSystem: {
  label: "Movement System\n(Physics & Jumps)"
}

CombatSystem: {
  label: "Combat System\n(Attacks & Damage)"
}

ClimbingSystem: {
  label: "Climbing System\n(Vertical Movement)"
}

AnimationSystem: {
  label: "Animation System\n(Visual States)"
}

Factory: {
  label: "createPlayer()\n(Factory Function)"
}

# System Creation
Factory -> Player: creates
Factory -> InputSystem: creates
Factory -> MovementSystem: creates
Factory -> CombatSystem: creates
Factory -> ClimbingSystem: creates
Factory -> AnimationSystem: creates

# System Registration
Player -> InputSystem: registers
Player -> MovementSystem: registers
Player -> CombatSystem: registers
Player -> ClimbingSystem: registers
Player -> AnimationSystem: registers
```

## Overview

The player controller uses a modular component-based system where each gameplay aspect is handled by a dedicated system. This provides excellent separation of concerns and makes the codebase easy to extend. The player controller consists of several specialized systems, each handling a specific aspect of player behavior.

### Core Systems

- **[Input](./input.md)** - Processes keyboard input and provides edge detection
- **[Movement](./movement.md)** - Handles physics-based movement, jumping, and double jumps
- **[Combat](./combat.md)** - Manages attack phases, hitboxes, and damage dealing
- **[Climbing](./climbing.md)** - Enables climbing on designated tilemap areas
- **[Animation](./animation.md)** - Coordinates sprite animations based on state

### Player Entity

The central `Player` class acts as the coordinator:
- Extends `Phaser.GameObjects.Sprite`
- Maintains a registry of all systems
- Manages player state (health, alive, climbing, attacking)
- Provides shared resources (input references, physics body)
- Updates all systems each frame

## Creating a Player

Use the factory function to create a fully configured player:

```typescript
import { createPlayer } from './features/player';

const player = createPlayer({
  scene: this,
  x: 100,
  y: 200,
  texture: 'player-sprite',
  
  // Optional configurations
  attackConfig: {
    name: 'sword_slash',
    damage: 15,
    reach: 60,
    // ... other attack settings
  },
  
  climbingConfig: {
    climbSpeed: 150,
    // ... other climbing settings
  }
});

// Add to scene
this.add.existing(player);
```

## System Communication

Systems communicate through:

1. **Direct Dependencies** - Systems receive references during construction
2. **Event Bus** - Global events for decoupled communication
3. **Shared State** - Player state object for common data

### Key Events

- `PLAYER_JUMP` - Emitted when player jumps
- `PLAYER_ATTACKED` - Emitted when attack starts
- `PLAYER_DAMAGED` - Emitted when taking damage
- `PLAYER_DIED` - Emitted when health reaches zero
- `PLAYER_CLIMB_START/END` - Climbing state changes

## Extending the System

To add new player abilities:

1. Create a new system class implementing the `System` interface
2. Add system creation in the factory function
3. Register the system with the player
4. Use events or direct references to integrate with other systems

Example:
```typescript
export class DashSystem implements System {
  update(time: number, delta: number): void {
    // Dash logic
  }
}

// In factory
const dashSystem = new DashSystem(player, inputSystem);
player.registerSystem('dash', dashSystem);
```

## Design Benefits

- **Modularity** - Each system is independent and focused
- **Testability** - Systems can be tested in isolation
- **Extensibility** - Easy to add new abilities
- **Maintainability** - Clear separation of concerns
- **Reusability** - Systems can be reused or replaced

For detailed information about each system, see the individual documentation pages linked above.
