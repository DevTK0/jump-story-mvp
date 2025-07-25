---
title: Debug
---

```d2 layout="elk"
DebugState: {
  shape: class
  +enabled: boolean
  +toggle(): void
  +getInstance(): DebugState
}

ShadowState: {
  shape: class
  +enabled: boolean
  +toggle(): void
  +getInstance(): ShadowState
}

IDebuggable: {
  shape: class
  +renderDebug?(graphics): void
  +getDebugInfo?(): Record<string, any>
  +isDebugEnabled?(): boolean
  +cleanupDebugResources?(): void
}

BaseDebugRenderer: {
  shape: class
  +renderDebug(graphics): void
  +getDebugInfo(): Record<string, any>
  +isDebugEnabled(): boolean
  # performDebugRender(graphics): void
  # provideDebugInfo(): Record<string, any>
}

DebugSystem: {
  shape: class
  -debuggableComponents: "IDebuggable[]"
  -graphics: Graphics
  -debugContainer: Container
  +update(time, delta): void
  +refreshDebuggableComponents(): void
  +enableDebugMode(): void
  +disableDebugMode(): void
}

PlayerDebugWrapper: {
  shape: class
  -player: Player
  +performDebugRender(graphics): void
  +provideDebugInfo(): Record<string, any>
}

BaseDebugRenderer -> IDebuggable: implements
DebugSystem -> IDebuggable: manages
PlayerDebugWrapper -> BaseDebugRenderer: extends
DebugSystem -> DebugState: uses
DebugSystem -> ShadowState: uses

```

The debug system provides comprehensive runtime debugging capabilities for the game. It uses a modular architecture where any component can implement debug interfaces to provide visual debugging information and runtime data inspection.

## Components

### Debug State Management

- **DebugState**: Global singleton managing debug mode on/off state
- **ShadowState**: Independent state for shadow effect visualization

### Debug Interfaces

- **IDebuggable**: Components implementing this can render debug visuals, provide debug information, and clean up debug resources
- **BaseDebugRenderer**: Abstract base class that eliminates duplicate debug state checks

### Debug Systems

- **DebugSystem**: Main orchestrator that collects all debuggable components and manages debug rendering
- **PlayerDebugWrapper**: Adapter that wraps the Player class to provide debug functionality
- **Component Debug Implementations**: MovementSystem, CombatSystem, and ClimbingSystem all implement debug interfaces

### Configuration

- **DEBUG_CONFIG**: Centralized configuration object containing all debug settings including colors, UI parameters, input bindings, and trajectory tracking options

### Features

The debug system provides these capabilities:

- **Visual Debug Rendering**: Player hitbox visualization, attack hitbox visualization, velocity vectors with directional arrows, climbeable area highlighting, collision detection visualization, movement trajectory tracking with shadow effects
- **Runtime Debug Information**: Player position and health status, movement state, combat state, physics body information, system-specific debug data from each component
- **Input Controls**: Debug toggle configured via `DEBUG_CONFIG.input.toggleKey`, shadow effect control via `ShadowState.getInstance().toggle()`
- **State-Based Architecture**: Debug state checked via polling when components need to render debug info, components query `DebugState.getInstance().enabled` directly

## Usage

### Enabling Debug Mode

Debug is toggled via keyboard input (configured in DEBUG_CONFIG)

When enabled, you'll see:

- Visual debug overlays (hitboxes, velocity vectors, collision areas)
- Runtime debug information in a scrollable window
- System-specific debug data from all registered components

### Adding Debug Support to New Components

```typescript
import { DEBUG_CONFIG } from '../debug/config'; // [!code ++]
import { BaseDebugRenderer } from '../debug/debug-renderer'; // [!code ++]
import type { IDebuggable } from '../debug/debug-interfaces'; // [!code ++]

export class MySystem extends BaseDebugRenderer implements IDebuggable { // [!code ++]
    ...

    protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void { // [!code ++]
        // Draw visual debug information
        graphics.lineStyle(2, DEBUG_CONFIG.colors.hitbox);
        graphics.strokeRect(this.x, this.y, this.width, this.height);
    }

    protected provideDebugInfo(): Record<string, any> { // [!code ++]
        return {
            state: this.currentState,
            position: { x: this.x, y: this.y },
            isActive: this.active,
        };
    }
}
```

The DebugSystem automatically discovers and manages components that implement `IDebuggable`.

## Integration

The debug system integrates with multiple game components through the IDebuggable interface:

```d2 layout="elk"
# External System Integration
PlayerFactory -> DebugSystem: creates and registers
Player -> DebugSystem: system registration
DebugSystem -> Player: discovers systems

# Component Integration
DebugSystem -> MovementSystem: collects debug info
DebugSystem -> CombatSystem: collects debug info
DebugSystem -> ClimbingSystem: collects debug info
DebugSystem -> PlaygroundScene: scene-level debugging

# Engine Integration
DebugSystem -> Phaser.Input: keyboard controls
DebugSystem -> Phaser.Graphics: visual rendering
DebugSystem -> Phaser.Container: UI management

# State Management
DebugSystem -> DebugState: global debug toggle
DebugSystem -> ShadowState: shadow effects
```

**Key Integration Points:**

- **Player Factory**: Creates DebugSystem instance and registers it with Player (player/index.ts)
- **System Discovery**: DebugSystem automatically discovers all components implementing IDebuggable (debug/debug-system.ts)
- **Component Registration**: All major player systems (Movement, Combat, Climbing) extend BaseDebugRenderer for consistent debug behavior
- **Scene Integration**: PlaygroundScene implements IDebuggable for scene-level debugging (scenes/playground-scene.ts)
- **Input Handling**: Integrates with Phaser keyboard input for debug toggle controls (debug/debug-system.ts)

## Configuration

Debug behavior is controlled by the DEBUG_CONFIG object in `debug/config.ts`:

```typescript
export const DEBUG_CONFIG = {
  trajectory: {
    maxPoints: 60, // Maximum trajectory points (1 second at 60fps)
    sampleRate: 2, // Sample every 2 frames for performance
    shadowSkipRate: 4, // Show every 4th point for shadows
    shadowAlphaRange: [0.3, 0.7], // Alpha range for shadow effects
    shadowTint: 0x666666, // Gray tint for shadows
  },
  colors: {
    hitbox: 0x00ff00, // Green for player hitbox
    attackHitbox: 0xff8800, // Orange for attack hitbox
    velocity: 0xffff00, // Yellow for velocity vectors
    collision: 0x4444ff, // Blue for collision boundaries
    climbeable: 0x00ff00, // Green for climbeable areas
    stateText: '#00ff00', // Green for debug text
  },
  ui: {
    stateTextSize: 16, // Font size for debug text
    stateTextPosition: [10, 10], // Text position on screen
    velocityScale: 0.5, // Scale factor for velocity arrows
    collisionCheckRadius: 400, // Radius for collision detection
    hitboxAlpha: 0.5, // Transparency for hitboxes
    arrowLength: 8, // Length of velocity arrows
    arrowAngle: Math.PI / 6, // Angle of arrow heads
    centerPointRadius: 3, // Radius of center point markers
  },
  input: {
    toggleKey: Phaser.Input.Keyboard.KeyCodes.D, // Debug toggle key
  },
};
```
