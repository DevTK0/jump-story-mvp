---
title: Climbing
---

```d2
ClimbingSystem: {
  shape: class

  physics: ClimbingPhysics
  collision: ClimbingCollision

  setClimbeableGroup(group): void
  isPlayerOnClimbeable(): boolean
  forceExitClimbing(): void
}

ClimbingPhysics: {
  shape: class

  enableClimbingPhysics(): void
  disableClimbingPhysics(): void
  calculateSnapVelocity(area): (velocityX, isSnapping)
  applyClimbingMovement(vx, vy): void
}

ClimbingCollision: {
  shape: class

  setClimbeableGroup(group): void
  isPlayerInClimbeableArea(): boolean
  getCurrentClimbeableArea(): StaticBody | null
  checkClimbableBelow(distance?): StaticBody | null
}

ClimbingSystem -> ClimbingPhysics: has
ClimbingSystem -> ClimbingCollision: has
```

## Overview

The ClimbingSystem enables players to climb ladders and similar objects. It has two main components: ClimbingPhysics manages gravity and movement calculations, while ClimbingCollision detects climbable areas and handles overlap checking.

## Components

### ClimbingPhysics

- Disables gravity during climbing and restores it when exiting
- Automatically centers player on ladder for smooth climbing
- Handles vertical movement based on UP/DOWN input

### ClimbingCollision

- Detects when player overlaps with climbable areas
- Checks if player is properly positioned to start climbing
- Detects ladders below player for platform edge climbing

### ClimbableGroup

- Physics group containing ladder collision rectangles from the tilemap
- Set up in your scene and passed to the climbing system

## Usage

### Setting Up Climbable Areas

```typescript
// In your scene
const climbableGroup = this.mapLoader.createClimbeablePhysics(mapData.climbeable);
const climbingSystem = player.getSystem('climbing');
climbingSystem.setClimbeableGroup(climbableGroup);
```

### Entry Conditions

- **Climbing up**: Press UP while overlapping a ladder
- **Climbing down**: Press DOWN while grounded (detects overlapping ladders or ladders below)

### During Climbing

- Gravity is disabled, player can move up/down with arrow keys
- Player automatically centers on ladder
- Horizontal movement is disabled

### Exit Conditions

- Press JUMP to dismount (with optional horizontal momentum)
- Move outside the climbable area boundary
- Press LEFT/RIGHT while grounded

## Events

The system emits events for other systems to react to:

- `PLAYER_CLIMB_START`: Fired when climbing begins (for animations, audio)
- `PLAYER_CLIMB_END`: Fired when climbing ends

## Integration

```d2
ClimbingSystem -> InputSystem: get input state
ClimbingSystem -> MovementSystem: check ground state
ClimbingSystem -> Player: control physics and state
ClimbingSystem -> GameEvents: emit climb events

GameEvents -> AnimationSystem: PLAYER_CLIMB_START/END
GameEvents -> AudioSystem: PLAYER_CLIMB_START/END

MapLoader -> ClimbingSystem: provide climbable areas
```

## Configuration

Climbing behavior is controlled by the climbing section in `config.ts`:

```typescript
PLAYER_CONFIG.climbing = {
  speed: 150, // Vertical movement speed
  centerThreshold: 0.7, // Required center alignment (70%)
  snapSpeed: 300, // Auto-centering speed
  checkDistance: 30, // Distance to check for climbables below
  exitJumpForceX: 100, // Horizontal velocity on jump exit
  exitJumpForceY: -200, // Vertical velocity on jump exit
};
```

## Tilemap Setup

Create climbable areas in Tiled editor:

1. Add an object layer called "Climbeable"
2. Draw rectangles over ladder graphics
3. The MapLoader will convert these to physics bodies
4. Position ladders close to platform edges for smooth climbing
