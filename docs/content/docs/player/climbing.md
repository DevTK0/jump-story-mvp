---
title: Climbing
---

```d2
direction: right

Player: {
  label: "Player\n(Main Entity)"
}

ClimbingSystem: {
  label: "ClimbingSystem"
}

InputSystem: {
  label: "InputSystem"
}

MovementSystem: {
  label: "MovementSystem"
}

ClimbableGroup: {
  label: "Climbable Areas\n(Tilemap)"
}

GameEvents: {
  label: "Game Events"
}

# Dependencies
Player -> ClimbingSystem: owns
ClimbingSystem -> InputSystem: reads climb input
ClimbingSystem -> MovementSystem: coordinates with
ClimbingSystem -> ClimbableGroup: detects overlaps

# Event Communication
ClimbingSystem -> GameEvents: PLAYER_CLIMB_START
ClimbingSystem -> GameEvents: PLAYER_CLIMB_END

# State Management
ClimbingSystem -> Player: isClimbing state
ClimbingSystem -> Player.body: gravity control
```

## Overview

The ClimbingSystem enables players to climb designated areas with gravity control and specialized movement. It allows players to climb specific areas marked in the tilemap, managing gravity suspension, climbing movement, and seamless transitions between climbing and normal movement states.

## Key Features

- **Tilemap Integration**: Detects climbable areas from map data
- **Gravity Management**: Disables gravity while climbing
- **Vertical Movement**: Up/down arrow controls during climb
- **Jump Dismount**: Jump off with directional control
- **Boundary Enforcement**: Prevents climbing outside designated areas
- **Legacy Support**: Maintains compatibility with config-based climbing

## Implementation Details

### Climbing Detection

The system supports two climbing modes:

1. **Tilemap-based** (Recommended): Uses Phaser.Physics.Arcade.Group for climbable areas
2. **Config-based** (Legacy): Fixed position climbing areas via ClimbingConfig

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
   - Reach boundary limits (config mode)
   - Leave climbable area (tilemap mode)

## Usage Example

```typescript
// Set up climbable areas from tilemap
const climbableGroup = scene.physics.add.group();
// Add rectangles from tilemap layer to group

const player = createPlayer(config);
const climbingSystem = player.getSystem<ClimbingSystem>('climbing');

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
- `PLAYER_CLIMB_START`: Fired when climbing begins
- `PLAYER_CLIMB_END`: Fired when climbing ends

### System Coordination
- **MovementSystem**: Disabled during climbing
- **InputSystem**: Provides climb direction input
- **AnimationSystem**: Can switch to climbing animations

### State Management
- Sets `player.isClimbing` flag
- Stores and restores gravity settings
- Manages climbing key states for smooth movement

## Configuration

### ClimbingConfig (Legacy)
```typescript
interface ClimbingConfig {
  x: number;           // Horizontal position
  topY: number;        // Top boundary
  bottomY: number;     // Bottom boundary  
  width: number;       // Climbable area width
  climbSpeed: number;  // Vertical movement speed
}
```

### Constants
- `CLIMB_SPEED`: Default climbing velocity (150)
- `CLIMB_TOP_BOUNDARY_OFFSET`: Top boundary padding
- `CLIMB_BOTTOM_BOUNDARY_OFFSET`: Bottom boundary padding
- `CLIMB_EXIT_PLAYER_OFFSET`: Exit position offset

## Best Practices

1. **Tilemap Setup**: Use object layers to define climbable rectangles
2. **Visual Indicators**: Add visual elements to show climbable areas
3. **Smooth Transitions**: Ensure animations sync with climb state changes
4. **Jump Dismount**: Allows strategic movement options for players