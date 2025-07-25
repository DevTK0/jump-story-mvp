---
title: Player
---

```d2 layout="elk"
Player: {
  shape: class
  +health: number
  +isClimbing: boolean
  +isAttacking: boolean
  +facingDirection: 1 \| -1
  +registerSystem()
  +getSystem()
  +update()
  +setPlayerState()
}

InputSystem: {
  shape: class
  +inputState: InputState
  +previousInputState: InputState
  +update()
  +isJustPressed()
  +getHorizontalDirection()
  +isClimbInputActive()
}

MovementSystem: {
  shape: class
  +hasUsedDoubleJump: boolean
  +shadowRenderer: ShadowTrajectoryRenderer
  +update()
  +forceJump()
  +setVelocity()
  +isOnGround()
}

ClimbingSystem: {
  shape: class
  +physics: ClimbingPhysics
  +collision: ClimbingCollision
  +isSnappingToCenter: boolean
  +update()
  +setClimbeableGroup()
  +isPlayerOnClimbeable()
}

CombatSystem: {
  shape: class
  +config: AttackConfig
  +isOnCooldown: boolean
  +hitboxSprite: Sprite
  +update()
  +tryAttack()
  +canAttack()
}

AnimationSystem: {
  shape: class
  +animations: Map
  +currentAnimation: string
  +isPlayingAttackAnimation: boolean
  +update()
  +playAnimation()
  +determineAnimation()
}

Player -> InputSystem: registers
Player -> MovementSystem: registers
Player -> ClimbingSystem: registers
Player -> CombatSystem: registers
Player -> AnimationSystem: registers
```

The player controller implements a sophisticated system-based architecture where the central Player class coordinates multiple specialized systems. Each system handles a specific aspect of player behavior while maintaining clear separation of concerns and enabling complex inter-system interactions through state management and event communication.

## Components

The Player controller consists of six main systems:

- **Player** - Central entity extending Phaser.GameObjects.Sprite that manages system registry and player state
- **InputSystem** - Centralized input processing with edge detection and state tracking
- **MovementSystem** - Basic movement, jumping, double-jump mechanics with shadow trajectory rendering
- **ClimbingSystem** - Complex climbing mechanics with physics override and collision detection
- **CombatSystem** - Multi-phase attack system with dynamic hitbox management
- **AnimationSystem** - Event-driven animation controller with state-based selection

## Usage

The factory function handles system creation and wiring automatically:

```typescript
import { createPlayer } from './features/player';

const player = createPlayer({
  scene: this,
  x: 100,
  y: 200,
  texture: 'soldier',
  attackConfig: {
    name: 'quick_slash',
    damage: 8,
    reach: 45,
    startupMs: 60,
    activeMs: 80,
    recoveryMs: 100,
  },
});
```

Access individual systems for advanced control:

```typescript
const inputSystem = player.getSystem<InputSystem>('input');
const movementSystem = player.getSystem<MovementSystem>('movement');

// Check if player can perform actions
if (movementSystem.isOnGround() && !player.isClimbing) {
  // Allow special ground attacks
}
```

State management through the Player entity:

```typescript
// Update player state
player.setPlayerState({
  health: 50,
  isClimbing: true,
});

// Read current state
const state = player.getPlayerState();
console.log(`Health: ${state.health}, Facing: ${state.facingDirection}`);
```

## Integration

The Player system integrates with external components through events and state management:

```d2 layout="elk"
GameEvents: {
  shape: oval
  label: "Global Event Bus"
}

PlayerConfig: {
  shape: diamond
  label: "PLAYER_CONFIG"
}

TilemapColliders: {
  shape: rectangle
  label: "Tilemap Groups"
}

SceneManager: {
  shape: rectangle
  label: "Scene Manager"
}

# External integrations
SceneManager -> Player: creates via factory
TilemapColliders -> ClimbingSystem: climbeable areas
PlayerConfig -> Player: movement/attack settings
Player -> GameEvents: emits state events
GameEvents -> AnimationSystem: triggers animations

# Internal system flow
InputSystem -> MovementSystem: input state
InputSystem -> ClimbingSystem: climb input
InputSystem -> CombatSystem: attack input
MovementSystem -> ClimbingSystem: defers when climbing
CombatSystem -> ClimbingSystem: blocks attacks when climbing
Player -> "All Systems": coordinates via registry
```

Key integration patterns:

- **State-Driven Coordination** - Systems check `player.isClimbing`, `player.isAttacking` to coordinate behavior
- **Event Communication** - Global events enable loose coupling between systems and external components
- **Physics Override** - ClimbingSystem temporarily overrides physics while maintaining original state
- **Cross-System Validation** - CombatSystem validates against ClimbingSystem state before allowing attacks

## Configuration

Core player settings are centralized in `PLAYER_CONFIG`:

```typescript
export const PLAYER_CONFIG = {
  movement: {
    speed: 200, // Horizontal movement speed
    jumpSpeed: 450, // Jump velocity
  },
  attack: {
    edgeOffset: 16, // Attack origin offset
    hitboxPositionMultiplier: 0.25, // Hitbox positioning
  },
  climbing: {
    speed: 150, // Climbing movement speed
    centerThreshold: 0.7, // Required alignment for climbing
    snapSpeed: 300, // Center-snapping speed
    alignmentTolerance: 2, // Pixel tolerance for alignment
  },
  animations: {
    soldier: {
      idle: { framerate: 8 },
      walk: { framerate: 12 },
      attack: { framerate: 20 },
    },
  },
};
```

Attack configurations support multiple attack types with independent timing and damage values in the CombatSystem class.
