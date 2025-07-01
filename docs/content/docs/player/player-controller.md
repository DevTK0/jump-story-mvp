---
title: Player Controller
---

## Component-Based System Architecture

The player controller is implemented as a component-based system using a central `Player` entity that registers and manages multiple specialized system classes. This architecture provides excellent separation of concerns and modularity.

```d2
direction: right

Player: {
  label: "Player Entity\n(Phaser.Sprite)"
}

InputSystem: {
  label: "InputSystem"
}

MovementSystem: {
  label: "MovementSystem"
}

CombatSystem: {
  label: "CombatSystem"
}

ClimbingSystem: {
  label: "ClimbingSystem"
}

AnimationSystem: {
  label: "AnimationSystem"
}

GameEvents: {
  label: "Game Events"
}

PlayerState: {
  label: "Player State"
}

Factory: {
  label: "createPlayer()"
}

# System registration and communication
Player -> InputSystem: registers
Player -> MovementSystem: registers
Player -> CombatSystem: registers
Player -> ClimbingSystem: registers
Player -> AnimationSystem: registers

# State management
Player -> PlayerState: manages
InputSystem -> PlayerState: reads/updates
MovementSystem -> PlayerState: reads
CombatSystem -> PlayerState: reads/updates
ClimbingSystem -> PlayerState: reads/updates

# Event communication
MovementSystem -> GameEvents: PLAYER_JUMP
CombatSystem -> GameEvents: PLAYER_ATTACKED, DAMAGE_DEALT
Player -> GameEvents: PLAYER_DAMAGED, PLAYER_DIED

# Factory creation
Factory -> Player: creates & configures
Factory -> InputSystem: creates
Factory -> MovementSystem: creates
Factory -> CombatSystem: creates
Factory -> ClimbingSystem: creates
Factory -> AnimationSystem: creates
```

## System Components

### Player Entity (`Player.ts`)

The central entity extending `Phaser.GameObjects.Sprite` that:

-   Manages a registry of systems via `Map<string, System>`
-   Maintains player state (health, alive, climbing, attacking, facing direction)
-   Provides input references (cursor keys, C/Z keys) to systems
-   Handles physics setup and visual updates (sprite flipping)
-   Coordinates system lifecycle (update, destroy)

**Key Methods:**

-   `registerSystem(name, system)` - Register a system with string key
-   `getSystem<T>(name)` - Retrieve typed system reference
-   `setPlayerState(updates)` - Update state with event emission
-   `update(time, delta)` - Update all registered systems

### InputSystem (`input.ts`)

Handles all keyboard input processing and state management:

-   Maintains current and previous input state for edge detection
-   Maps physical keys to logical actions (left, right, up, down, jump, attack)
-   Provides convenience methods: `isJustPressed()`, `isJustReleased()`, `isPressed()`
-   Updates player facing direction based on movement input
-   Special methods for climbing and double jump input

**Input Mapping:**

-   Arrow keys / WASD: directional movement
-   Space: jump
-   C: double jump
-   Z: attack

### MovementSystem (`movement.ts`)

Manages physics-based player movement:

-   Horizontal movement (only when on ground)
-   Jump mechanics with velocity application
-   Double jump system with usage tracking
-   Ground detection and state management
-   Integration with climbing system (disables movement when climbing)

**Features:**

-   Respects ground state for movement
-   Double jump cooldown and reset on landing
-   Emits `PLAYER_JUMP` events for audio/visual feedback
-   Public API for other systems to trigger movement

### CombatSystem (`combat.ts`)

Complex attack system with sophisticated timing:

-   **Attack Phases**: Startup → Active → Recovery with precise timing
-   **Hitbox Management**: Dynamically positioned physics sprite
-   **Cooldown System**: Prevents attack spam with configurable timing
-   **Damage Dealing**: Emits `DAMAGE_DEALT` events for enemy collision
-   **State Coordination**: Updates `isAttacking` player state

**Attack Configuration:**

-   Startup: 80ms preparation
-   Active: 100ms damage window
-   Recovery: 120ms completion
-   Total Cooldown: 400ms between attacks
-   Configurable reach, damage, and timing

### ClimbingSystem (`climbing.ts`)

Handles climbing on designated tilemap areas:

-   **Tilemap Integration**: Detects climbable areas from map data
-   **Gravity Control**: Disables gravity when climbing
-   **Climbing Movement**: Vertical movement with up/down arrows
-   **Entry/Exit Logic**: Automatic climbing state transitions
-   **Boundary Management**: Prevents climbing outside designated areas

### AnimationSystem (`animations.ts`)

Manages sprite animations based on player state:

-   **State-Based Animation**: Switches between idle, walk, attack animations
-   **Event-Driven Updates**: Listens to `PLAYER_ATTACKED` events
-   **Animation Coordination**: Ensures proper timing with combat system
-   **Resource Management**: Handles animation asset loading and cleanup

## Factory Pattern

### createPlayer() Function (`index.ts`)

The factory function that creates a fully configured player:

```typescript
function createPlayer(config: PlayerFactoryConfig): Player {
    // 1. Create Player entity
    const player = new Player(config);

    // 2. Create all systems with dependencies
    const inputSystem = new InputSystem(player);
    const movementSystem = new MovementSystem(player, inputSystem);
    const climbingSystem = new ClimbingSystem(
        player,
        inputSystem,
        movementSystem,
        scene
    );
    const combatSystem = new CombatSystem(
        player,
        inputSystem,
        scene,
        attackConfig
    );
    const animationSystem = new AnimationSystem(player, inputSystem, scene);

    // 3. Register all systems
    player.registerSystem("input", inputSystem);
    player.registerSystem("movement", movementSystem);
    player.registerSystem("climbing", climbingSystem);
    player.registerSystem("combat", combatSystem);
    player.registerSystem("animations", animationSystem);

    return player;
}
```

**Benefits:**

-   **Dependency Injection**: Systems receive their dependencies
-   **Configuration**: Optional climbing and attack configs
-   **Encapsulation**: Complex wiring hidden from caller
-   **Testability**: Systems can be mocked/replaced easily

## Event-Driven Communication

Systems communicate via a global `gameEvents` bus:

**Events Emitted:**

-   `PLAYER_JUMP` - Movement system on jump actions
-   `PLAYER_ATTACKED` - Combat system on attack initiation
-   `PLAYER_DAMAGED` - Player entity on health decrease
-   `PLAYER_DIED` - Player entity when health reaches zero
-   `DAMAGE_DEALT` - Combat system during active attack phase

**Benefits:**

-   **Decoupling**: Systems don't need direct references
-   **Extensibility**: New systems can listen to existing events
-   **Audio/Visual Integration**: External systems can react to player actions

## State Management

The `PlayerState` object tracks:

```typescript
interface PlayerState {
    health: number;
    maxHealth: number;
    isAlive: boolean;
    isClimbing: boolean;
    isAttacking: boolean;
    canJump: boolean;
    facingDirection: 1 | -1;
}
```

**State Updates:**

-   Immutable updates via `setPlayerState()`
-   Automatic event emission on changes
-   Type-safe getter methods for common properties
-   Damage/healing methods with bounds checking

## Key Design Patterns

1. **Component-Based Architecture** - Systems handle specific concerns
2. **Factory Pattern** - `createPlayer()` encapsulates complex construction
3. **Registry Pattern** - `Map<string, System>` for system management
4. **Observer Pattern** - Event bus for cross-system communication
5. **State Pattern** - PlayerState object with immutable updates

This architecture provides excellent modularity, testability, and extensibility while maintaining clear separation of concerns between input handling, movement, combat, climbing, and animation systems.
