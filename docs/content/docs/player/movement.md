---
title: Movement
---

```d2
direction: right

Player: {
  label: "Player\n(Main Entity)"
}

MovementSystem: {
  label: "MovementSystem"
}

InputSystem: {
  label: "InputSystem"
}

PhysicsBody: {
  label: "Physics Body\n(Phaser)"
}

GameEvents: {
  label: "Game Events"
}

# Dependencies
Player -> MovementSystem: owns
MovementSystem -> InputSystem: reads input
MovementSystem -> PhysicsBody: controls velocity

# Event Communication
MovementSystem -> GameEvents: PLAYER_JUMP

# State Flow
InputSystem -> MovementSystem: jump pressed
MovementSystem -> PhysicsBody: apply jump velocity
PhysicsBody -> MovementSystem: onGround state
```

## Overview

The MovementSystem handles all physics-based player movement including horizontal movement, jumping, and double jumping. It translates player input into physics-based movement, managing horizontal movement when grounded, regular jumps, and double jumps with proper state tracking.

## Key Features

- **Ground-based Movement**: Horizontal movement only when player is on ground
- **Jump Mechanics**: Single jump with configurable velocity
- **Double Jump**: Secondary jump available in mid-air with cooldown
- **Velocity Control**: Direct API for setting player velocity
- **Ground Detection**: Tracks whether player is on ground

## Implementation Details

### Dependencies
- `Player`: The main player entity that owns this system
- `InputSystem`: Provides processed input state
- `Phaser.Physics.Arcade.Body`: The physics body for velocity control

### Core Methods

```typescript
update(time: number, delta: number): void
```
Main update loop that:
1. Checks if player is climbing (movement disabled during climb)
2. Handles horizontal movement when grounded
3. Processes jump input
4. Manages double jump state

```typescript
forceJump(velocityMultiplier: number = 1): void
```
Public method allowing other systems to trigger a jump with optional velocity multiplier.

```typescript
setVelocity(x?: number, y?: number): void
```
Direct velocity control for special movement scenarios.

### State Management

The system tracks:
- `hasUsedDoubleJump`: Boolean flag reset on landing
- Ground state via `body.onFloor()`

## Usage Example

```typescript
// The MovementSystem is created and registered by the player factory
const player = createPlayer(config);
const movementSystem = player.getSystem<MovementSystem>('movement');

// Force a jump from another system
movementSystem.forceJump(1.5); // Jump with 1.5x normal velocity

// Check if player is grounded
const onGround = movementSystem.isOnGround();

// Stop all movement
movementSystem.stopMovement();
```

## Integration Points

### Events Emitted
- `PLAYER_JUMP`: Emitted when player jumps (includes velocity data)

### Interactions with Other Systems
- **ClimbingSystem**: Movement is disabled when `player.isClimbing` is true
- **CombatSystem**: Can trigger movement via public API methods
- **InputSystem**: Reads input state each frame

## Configuration

Movement parameters are defined on the Player entity:
- `player.getSpeed()`: Horizontal movement speed
- `player.getJumpSpeed()`: Vertical jump velocity

These values can be configured when creating the player via the factory function.