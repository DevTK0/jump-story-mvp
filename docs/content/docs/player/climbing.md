---
title: Climbing
---

```d2

shape: sequence_diagram
GameLoop: "Game Loop"
ClimbingSystem: "ClimbingSystem"
InputSystem: "InputSystem"
MovementSystem: "MovementSystem"
Player: "Player"
ClimbableGroup: "Climbable Areas"
GameEvents: "Game Events"

# Every Frame Flow
GameLoop -> ClimbingSystem: update()
ClimbingSystem -> ClimbingSystem: checkClimbeableOverlap()
ClimbingSystem -> ClimbableGroup: check physics overlap
ClimbableGroup -> ClimbingSystem: isInClimbeableArea = true/false

# State Check
ClimbingSystem -> Player: check isClimbing

# NOT CLIMBING: Check for climbing start
ClimbingSystem -> InputSystem: getInputState()
InputSystem -> ClimbingSystem: input.up || input.down
ClimbingSystem -> MovementSystem: isOnGround()
MovementSystem -> ClimbingSystem: onGround = true/false

# CONDITIONAL: Start climbing if conditions met
ClimbingSystem -> ClimbingSystem: IF (input.up && isInClimbeableArea) OR\n(input.down && onGround && isInClimbeableArea)
ClimbingSystem -> Player: setPlayerState(isClimbing: true)
ClimbingSystem -> Player: body.setGravityY(0)
ClimbingSystem -> GameEvents: emit(PLAYER_CLIMB_START)

# CLIMBING: Movement and exit handling
ClimbingSystem -> InputSystem: getInputState()
InputSystem -> ClimbingSystem: movement input
ClimbingSystem -> Player: body.setVelocity(0, targetVelocityY)

# Exit via jump
ClimbingSystem -> InputSystem: check input.jump
ClimbingSystem -> MovementSystem: forceJump()
ClimbingSystem -> Player: setPlayerState(isClimbing: false)
ClimbingSystem -> Player: body.setGravityY(originalGravity)
ClimbingSystem -> GameEvents: emit(PLAYER_CLIMB_END)
```

## Overview

The ClimbingSystem enables players to climb designated areas with gravity control and specialized movement. It uses tilemap-based detection to identify climbable areas, managing gravity suspension, climbing movement, and seamless transitions between climbing and normal movement states.

## Key Features

-   **Tilemap Integration**: Detects climbable areas from map data
-   **Gravity Management**: Disables gravity while climbing
-   **Vertical Movement**: Up/down arrow controls during climb
-   **Jump Dismount**: Jump off with directional control
-   **Boundary Enforcement**: Prevents climbing outside designated areas

## Implementation Details

### Climbing Detection

The system uses tilemap-based climbing detection through Phaser.Physics.Arcade.Group for climbable areas.

### Core Methods

```typescript
setClimbeableGroup(group: Phaser.Physics.Arcade.Group): void
```

Sets the physics group containing climbable area rectangles from tilemap.

```typescript
isPlayerOnClimbeable(): boolean
```

Checks if player is currently overlapping a climbable area.

```typescript
forceExitClimbing(): void
```

Forces player to stop climbing (used by other systems).

### Climbing States

1. **Entry Conditions**:

    - Press UP while in climbable area
    - Press DOWN while grounded in climbable area

2. **During Climbing**:

    - Gravity set to 0
    - Vertical movement with UP/DOWN keys
    - Horizontal movement disabled
    - Other systems check `player.isClimbing`

3. **Exit Conditions**:
    - Press JUMP to dismount with optional horizontal velocity
    - Leave climbable area

## Usage Example

```typescript
// Set up climbable areas from tilemap
const climbableGroup = scene.physics.add.group();
// Add rectangles from tilemap layer to group

const player = createPlayer(config);
const climbingSystem = player.getSystem<ClimbingSystem>("climbing");

// Register climbable areas
climbingSystem.setClimbeableGroup(climbableGroup);

// Check if player can start climbing
if (climbingSystem.canGrabClimbeable()) {
    // Player is in position to climb
}

// Force exit from climbing (e.g., from damage)
climbingSystem.forceExitClimbing();
```

## Integration Points

### Events Emitted

-   `PLAYER_CLIMB_START`: Fired when climbing begins
-   `PLAYER_CLIMB_END`: Fired when climbing ends

### System Coordination

-   **MovementSystem**: Disabled during climbing
-   **InputSystem**: Provides climb direction input
-   **AnimationSystem**: Can switch to climbing animations

### State Management

-   Sets `player.isClimbing` flag
-   Stores and restores gravity settings
-   Manages climbing key states for smooth movement

## Configuration

### Constants

-   `CLIMB_SPEED`: Default climbing velocity (150)

## Best Practices

1. **Tilemap Setup**: Use object layers to define climbable rectangles
2. **Visual Indicators**: Add visual elements to show climbable areas
3. **Smooth Transitions**: Ensure animations sync with climb state changes
4. **Jump Dismount**: Allows strategic movement options for players
