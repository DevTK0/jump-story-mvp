---
title: Input
---

```d2
direction: right

Keyboard: {
  label: "Keyboard\n(Physical Input)"
}

InputSystem: {
  label: "InputSystem"
}

InputState: {
  label: "Input State\n(Current)"
}

PreviousState: {
  label: "Previous State\n(Last Frame)"
}

Player: {
  label: "Player\n(Main Entity)"
}

OtherSystems: {
  label: "Other Systems\n(Movement, Combat, etc.)"
}

# Input Flow
Keyboard -> InputSystem: raw input
InputSystem -> InputState: updates
InputSystem -> PreviousState: stores

# Dependencies
Player -> InputSystem: provides keys/cursors
InputSystem -> Player: updates facing direction

# System Usage
OtherSystems -> InputSystem: query input state
```

## Overview

The InputSystem processes keyboard input and provides a clean interface for other systems to query input state. It is the central hub for all player input processing, maintaining current and previous input states to enable edge detection (just pressed/released) and provides a clean API for other systems to query input without directly accessing Phaser input objects.

## Key Features

- **State Management**: Tracks current and previous frame input
- **Edge Detection**: Detects when keys are just pressed or released
- **Input Mapping**: Maps physical keys to logical actions
- **Direction Helpers**: Provides horizontal/vertical direction values
- **Facing Direction**: Updates player facing based on movement

## Input Mapping

| Physical Key | Logical Action | Description |
|-------------|----------------|-------------|
| Arrow Left / A | `left` | Move left |
| Arrow Right / D | `right` | Move right |
| Arrow Up / W | `up` | Climb up / Enter climb |
| Arrow Down / S | `down` | Climb down |
| Space | `jump` | Jump |
| C | Double Jump | Special double jump |
| Z | `attack` | Attack action |

## Implementation Details

### Input State Structure

```typescript
interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  attack: boolean;
}
```

### Core Methods

```typescript
getInputState(): Readonly<InputState>
```
Returns the current frame's input state.

```typescript
isJustPressed(input: keyof InputState): boolean
```
Returns true if the input was pressed this frame but not last frame.

```typescript
isJustReleased(input: keyof InputState): boolean
```
Returns true if the input was released this frame.

```typescript
isPressed(input: keyof InputState): boolean
```
Returns true if the input is currently pressed.

### Direction Helpers

```typescript
getHorizontalDirection(): -1 | 0 | 1
```
Returns -1 for left, 1 for right, 0 for no input or both.

```typescript
getClimbDirection(): -1 | 0 | 1
```
Returns 1 for up, -1 for down, 0 for no input or both.

## Usage Example

```typescript
// Access input system from player
const player = createPlayer(config);
const inputSystem = player.getSystem<InputSystem>('input');

// In another system's update loop
update(time: number, delta: number) {
  // Check for jump input
  if (inputSystem.isJustPressed('jump')) {
    // Trigger jump (edge detection)
  }
  
  // Get movement direction
  const moveDir = inputSystem.getHorizontalDirection();
  if (moveDir !== 0) {
    // Apply horizontal movement
  }
  
  // Check if attack is held
  if (inputSystem.isPressed('attack')) {
    // Charge attack
  }
  
  // Special double jump check
  if (inputSystem.isDoubleJumpPressed()) {
    // Perform double jump
  }
}
```

## Edge Detection

Edge detection is crucial for responsive controls:

- **Just Pressed**: Triggers once when key goes down
- **Just Released**: Triggers once when key goes up
- **Is Pressed**: True while key is held

This prevents actions from repeating every frame and enables precise timing for gameplay mechanics.

## Integration Points

### Automatic Updates
- Updates player facing direction when not climbing
- Maintains input history for edge detection

### System Dependencies
All player systems depend on InputSystem for control:
- **MovementSystem**: Reads movement and jump input
- **CombatSystem**: Checks for attack input
- **ClimbingSystem**: Monitors climb direction and entry
- **AnimationSystem**: May read input for animation states

## Best Practices

1. **Use Edge Detection**: For single-trigger actions (jump, attack)
2. **Use Continuous State**: For held actions (movement, climbing)
3. **Check Order**: Process input checks early in update loops
4. **Input Buffering**: Consider adding input buffering for better game feel