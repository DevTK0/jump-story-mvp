---
title: Animation
---

```d2
direction: right

Player: {
  label: "Player\n(Sprite)"
}

AnimationSystem: {
  label: "AnimationSystem"
}

GameEvents: {
  label: "Game Events"
}

AnimationConfigs: {
  label: "Animation Configs\n(idle, walk, attack)"
}

PhysicsBody: {
  label: "Physics Body\n(Velocity)"
}

# Dependencies
Player -> AnimationSystem: owns
AnimationSystem -> AnimationConfigs: manages
AnimationSystem -> PhysicsBody: reads velocity

# Event Communication
GameEvents -> AnimationSystem: PLAYER_ATTACKED

# Animation Flow
AnimationSystem -> Player: play(animationKey)
PhysicsBody -> AnimationSystem: velocity state
```

## Overview

The AnimationSystem coordinates sprite animations based on player state, movement, and combat events. It ensures smooth transitions between animations and handles animation priorities (e.g., attack animations override movement).

## Key Features

-   **State-based Animations**: Automatically switches based on player state
-   **Event-driven Updates**: Responds to combat events for attack animations
-   **Priority System**: Attack animations take precedence
-   **Smooth Transitions**: Only changes animation when needed
-   **Custom Animation Support**: API for adding new animations

## Animation Definitions

### Default Animations

| Animation Key          | Sprite Frames | Frame Rate | Description   |
| ---------------------- | ------------- | ---------- | ------------- |
| `soldier-idle-anim`    | 0-5           | 10 fps     | Idle stance   |
| `soldier-walk-anim`    | 9-16          | 10 fps     | Walking cycle |
| `soldier-attack1-anim` | 18-22         | 10 fps     | Basic attack  |

## Implementation Details

### Animation Configuration

```typescript
interface PlayerAnimationConfig {
    key: string; // Unique animation identifier
    spriteKey: string; // Sprite sheet key
    frames: {
        // Frame range
        start: number;
        end: number;
    };
    frameRate: number; // Playback speed
    repeat: number; // -1 for loop, 0 for once
}
```

### Core Methods

```typescript
createCustomAnimation(
  key: string,
  spriteKey: string,
  frames: { start: number; end: number },
  frameRate: number,
  repeat: number = -1
): void
```

Creates a new animation at runtime.

```typescript
forcePlayAnimation(animationKey: string): void
```

Immediately plays specified animation, overriding current state.

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
const animationSystem = player.getSystem<AnimationSystem>("animations");

// Add custom animation
animationSystem.createCustomAnimation(
    "player-dash-anim",
    "player-sprite",
    { start: 24, end: 28 },
    15, // 15 fps
    0 // Play once
);

// Force play specific animation
animationSystem.forcePlayAnimation("player-dash-anim");

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

-   `PLAYER_ATTACKED`: Triggers attack animation sequence
-   Attack animation blocks other animations for duration

### State Dependencies

-   Reads `player.isAlive` for death state
-   Reads `player.isClimbing` for climb animations
-   Monitors physics body velocity for movement

### Animation Timing

-   Attack animations use timeout (300ms) to reset state
-   Consider using animation complete events for better accuracy

## Best Practices

1. **Frame Rate Balance**: Match animation speed to game feel
2. **Sprite Sheet Organization**: Group related frames together
3. **Animation Events**: Use Phaser animation events for precise timing
4. **State Machines**: Consider state machine for complex animation flows
5. **Preload Assets**: Ensure sprite sheets are loaded before creating animations
