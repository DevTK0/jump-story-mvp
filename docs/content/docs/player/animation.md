---
title: Animation
---

```d2
direction: right

Player: {
  shape: class
  label: "Player\n(Sprite)"
}

AnimationSystem: {
  shape: class
  label: "AnimationSystem"
  animationManager: PlayerAnimationManager
  isPlayingAttackAnimation: boolean
  isPlayingDamagedAnimation: boolean
  isInvulnerable: boolean
}

PlayerAnimationManager: {
  shape: class
  sprite: Phaser.GameObjects.Sprite
  scene: Phaser.Scene
  play(): boolean
  stop(): void
  getCurrentAnimation(): string
  isPlaying(): boolean
}

SceneEvents: {
  shape: class
  label: "Scene Events"
  player:attacked: event
  player:died: event
}

AnimationFactory: {
  shape: class
  label: "AnimationFactory\n(Static)"
  getAnimationKey(): string
}

PhysicsBody: {
  shape: class
  label: "Physics Body"
  velocity: {x: number, y: number}
}

# Dependencies
Player -> AnimationSystem: owns
AnimationSystem -> PlayerAnimationManager: uses
PlayerAnimationManager -> Player: controls sprite
AnimationSystem -> PhysicsBody: reads velocity
PlayerAnimationManager -> AnimationFactory: uses static method

# Event Communication
SceneEvents -> AnimationSystem: player:attacked

# Animation Flow
AnimationSystem -> Player: determines animation
PlayerAnimationManager -> Player: sprite.play()
```

## Overview

The AnimationSystem coordinates sprite animations based on player state, movement, and combat events. It ensures smooth transitions between animations and handles animation priorities (e.g., attack animations override movement).

## Key Features

- **State-based Animations**: Automatically switches based on player state
- **Event-driven Updates**: Responds to combat events for attack animations
- **Priority System**: Attack animations take precedence
- **Smooth Transitions**: Only changes animation when needed
- **Invulnerability System**: Visual feedback and damage immunity after taking damage

## Animation Definitions

### Default Animations

| Animation Key          | Sprite Frames | Frame Rate | Description   |
| ---------------------- | ------------- | ---------- | ------------- |
| `soldier-idle-anim`    | 0-5           | 10 fps     | Idle stance   |
| `soldier-walk-anim`    | 9-16          | 10 fps     | Walking cycle |
| `soldier-attack1-anim` | 18-22         | 10 fps     | Basic attack  |

## Implementation Details

### Core Methods

```typescript
getCurrentAnimation(): string | null
```

Returns the currently playing animation key.

### Animation Priority

1. **Death Animation** (if implemented): Highest priority when `!player.isAlive`
2. **Attack Animation**: Takes precedence during attack phase
3. **Movement Animation**: Based on velocity when moving
4. **Idle Animation**: Default when stationary

## Usage Example

```typescript
// Access animation system
const player = createPlayer(config);
const animationSystem = player.getSystem<AnimationSystem>('animations');

// Check current animation
const currentAnim = animationSystem.getCurrentAnimation();

// Animation control
animationSystem.pauseAnimation();
animationSystem.resumeAnimation();
animationSystem.stopAnimation();
```

## State Detection Logic

The system determines animations based on:

1. **Climbing State**: Uses idle animation (placeholder for climb animations)
2. **Velocity Check**: `Math.abs(body.velocity.x) > 0.1` triggers walk animation
3. **Attack Events**: `PLAYER_ATTACKED` event triggers attack animation
4. **Default State**: Idle animation when no other conditions met

## Integration Points

### Event Listeners

- `player:attacked`: Triggers attack animation sequence based on attackType
- `player:died`: Could trigger death animation (if implemented)
- Attack animation blocks other animations for duration

### State Dependencies

- Reads `player.isAlive` for death state
- Reads `player.isClimbing` for climb animations
- Monitors physics body velocity for movement

### Animation Timing

- Attack animations use timeout (300ms) to reset state
- Consider using animation complete events for better accuracy

### Comparison with Other Entities

**Player vs Enemy/Peer Animation Systems:**

- **Player (Local)**: Uses separate AnimationSystem that runs every frame, considers velocity + state + events
- **Enemy**: Uses state-based animations where each state directly plays its animation (simpler 1:1 mapping)
- **Peer (Remote Players)**: Uses same state-based approach as enemies, with states directly controlling animations

This architectural difference reflects gameplay needs:
- Players need complex, responsive animations reacting to multiple inputs
- Enemies and peers need predictable, server-driven animations that follow state changes

## Best Practices

1. **Frame Rate Balance**: Match animation speed to game feel
2. **Sprite Sheet Organization**: Group related frames together
3. **Animation Events**: Use Phaser animation events for precise timing
4. **State Machines**: Consider state machine for complex animation flows
5. **Preload Assets**: Ensure sprite sheets are loaded before creating animations
