---
title: Debug
---

```d2
Debug System Architecture {
  Debug State Manager {
    DebugState: Global singleton state
    ShadowState: Shadow effect state
  }

  Debug Components {
    IDebuggable: Interface for debug rendering and cleanup
    BaseDebugRenderer: Abstract base class
  }

  Debug Systems {
    DebugSystem: Main orchestrator
    PlayerDebugWrapper: Player debug adapter
    MovementSystem: Movement debug info
    CombatSystem: Combat debug info
    ClimbingSystem: Climbing debug info
  }

  Debug Configuration {
    DEBUG_CONFIG: Centralized settings
    Colors: Visual debug colors
    UI: Layout and positioning
    Input: Keyboard controls
    Trajectory: Movement tracking
  }

  Debug State Manager -> Debug Systems: State updates
  Debug Systems -> Debug Components: Implements interfaces
  Debug Configuration -> Debug Systems: Configuration settings
  DebugSystem -> Debug Components: Collects and renders
}
```

## Overview

The debug system provides comprehensive runtime debugging capabilities for the game. It uses a modular architecture where any component can implement debug interfaces to provide visual debugging information and runtime data inspection.

## Core Components

### Debug State Management

-   **DebugState**: Global singleton managing debug mode on/off state
-   **ShadowState**: Independent state for shadow effect visualization

### Debug Interfaces

-   **IDebuggable**: Components implementing this can render debug visuals, provide debug information, and clean up debug resources
-   **BaseDebugRenderer**: Abstract base class that eliminates duplicate debug state checks

### Debug Systems

-   **DebugSystem**: Main orchestrator that collects all debuggable components and manages debug rendering
-   **PlayerDebugWrapper**: Adapter that wraps the Player class to provide debug functionality
-   **Component Debug Implementations**: MovementSystem, CombatSystem, and ClimbingSystem all implement debug interfaces

### Configuration

-   **DEBUG_CONFIG**: Centralized configuration object containing all debug settings including colors, UI parameters, input bindings, and trajectory tracking options

## Key Features

### Visual Debug Rendering

-   Player hitbox visualization (green outline)
-   Attack hitbox visualization (orange outline)
-   Velocity vectors with directional arrows
-   Climbeable area highlighting
-   Collision detection visualization
-   Movement trajectory tracking with shadow effects

### Runtime Debug Information

-   Player position and health status
-   Movement state (facing direction, can jump, is climbing)
-   Combat state (is attacking, cooldown status)
-   Physics body information (hitbox dimensions)
-   System-specific debug data from each component

### Input Controls

-   **'D' Key**: Toggle debug mode on/off
-   **Shadow Effect**: Can be controlled programmatically via `ShadowState.getInstance().toggle()`

### State-Based Architecture

-   Debug state is checked via polling when components need to render debug info
-   Components query `DebugState.getInstance().enabled` directly
-   Simple and reliable approach with no subscription management needed

## Usage for New Developers

### Adding Debug Support to New Components

1. **Implement IDebuggable interface**:

    ```typescript
    export class MySystem extends BaseDebugRenderer implements IDebuggable {
        protected performDebugRender(
            graphics: Phaser.GameObjects.Graphics
        ): void {
            // Your debug rendering logic
        }

        protected provideDebugInfo(): Record<string, any> {
            return {
                myProperty: this.someValue,
                myState: this.currentState,
            };
        }

        cleanupDebugResources?(): void {
            // Clean up debug-only sprites, graphics, etc. (optional)
        }
    }
    ```

2. **Extend BaseDebugRenderer**: This eliminates the need to manually check debug state in each component.

3. **Add to DebugSystem**: The system automatically collects components that implement IDebuggable.

### Configuring Debug Visuals

Modify `DEBUG_CONFIG` in `shared/debug.ts` to customize:

-   Debug colors for different visual elements
-   UI positioning and sizing
-   Input key bindings
-   Trajectory tracking parameters
-   Performance settings (sample rates, point limits)

The debug system is designed to be completely disableable at runtime while providing powerful introspection capabilities during development.
