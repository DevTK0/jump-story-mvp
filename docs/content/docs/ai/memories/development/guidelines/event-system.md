---
title: Event System Architecture
type: note
permalink: development/guidelines/event-system-architecture
tags:
- '["architecture"'
- '"events"'
- '"typescript"'
- '"phaser"'
- '"guidelines"]'
---

# Event System Architecture

## Overview

The game uses Phaser's built-in `scene.events` with a type-safe wrapper for all cross-system communication. This approach provides compile-time type safety, automatic memory management, and clear event contracts.

## Core Implementation

### Event Type Definitions

All scene events are defined in `/libs/core/scene-events.ts`:

```typescript
export interface SceneEventMap {
  'player:attacked': {
    type: 'melee' | 'ranged' | 'standard';
    direction: number;
    attackType: number;
    damage?: number;
    critChance?: number;
  };
  'player:died': {
    position: { x: number; y: number };
  };
  // Add new events here
}
```

### Type-Safe Helper Functions

The system provides four helper functions for type-safe event handling:

1. **emitSceneEvent** - Emit events with type checking
2. **onSceneEvent** - Listen to events with typed callbacks
3. **onceSceneEvent** - One-time listeners
4. **offSceneEvent** - Remove listeners (rarely needed)

## Usage Examples

### Emitting Events

```typescript
// In combat system
import { emitSceneEvent } from '@/core/scene-events';

emitSceneEvent(this.scene, 'player:attacked', {
  type: 'melee',
  direction: facing,
  attackType: attackNumber
});
```

### Listening to Events

```typescript
// In animation system
import { onSceneEvent } from '@/core/scene-events';

onSceneEvent(this.scene, 'player:attacked', (data) => {
  // data is fully typed - TypeScript knows all properties
  const attackType = data.attackType; // number
  if (data.type === 'melee') { // type-safe comparison
    this.playMeleeAnimation(attackType);
  }
});
```

## Current Events

### player:attacked
- **Emitted by**: CombatSystem, CombatSystemEnhanced
- **Consumed by**: AnimationSystem (plays attack animations), InteractionHandler (tracks attack state)
- **Purpose**: Coordinates attack animations and multiplayer state

### player:died
- **Emitted by**: Player class when health reaches 0
- **Consumed by**: ClimbingSystem (exits climbing state)
- **Purpose**: Handles cleanup of special states on death

## Design Principles

### 1. Use Scene Events for Cross-System Communication
- Scene events are for communication between different game systems
- Direct method calls are preferred for 1-to-1 relationships within a system

### 2. Automatic Memory Management
- Listeners are automatically cleaned up when the scene is destroyed
- No need for manual `off()` calls in destroy methods
- This prevents memory leaks from forgotten cleanup

### 3. Type Safety First
- All events must be defined in SceneEventMap
- TypeScript enforces correct event names and data shapes
- No `any` types in event callbacks

### 4. Event Naming Convention
- Use colon-separated namespaces: `entity:action`
- Examples: `player:attacked`, `enemy:spawned`, `ui:updated`
- Keep names descriptive but concise

## Adding New Events

1. Add the event type to SceneEventMap:
```typescript
export interface SceneEventMap {
  // ... existing events
  'enemy:damaged': {
    enemyId: number;
    damage: number;
    source: string;
  };
}
```

2. Emit the event:
```typescript
emitSceneEvent(this.scene, 'enemy:damaged', {
  enemyId: enemy.id,
  damage: 50,
  source: 'player'
});
```

3. Listen for the event:
```typescript
onSceneEvent(this.scene, 'enemy:damaged', (data) => {
  this.updateHealthBar(data.enemyId, data.damage);
});
```

## Migration History

The event system was refactored from a global singleton pattern that had several issues:
- 82% of defined events were never consumed (dead code)
- No type safety despite TypedEventEmitter name
- Manual cleanup required (memory leak risk)
- Hidden dependencies through global state

The current system solves all these issues while maintaining the same functionality.

## Best Practices

1. **Don't over-use events** - Direct method calls are often clearer for simple cases
2. **Keep event data minimal** - Only include what consumers actually need
3. **Document event flows** - Note what emits and consumes each event
4. **Use events for broadcasts** - When multiple systems need to know about something
5. **Avoid event chains** - Don't emit events from event handlers (can cause loops)

## Common Patterns

### Conditional Listeners
```typescript
onSceneEvent(this.scene, 'player:attacked', (data) => {
  if (this.isVulnerable) {
    this.takeDamage(data.damage || 10);
  }
});
```

### One-Time Setup
```typescript
onceSceneEvent(this.scene, 'game:started', () => {
  this.initializeGameSystems();
});
```

### State-Based Listeners
```typescript
class Boss {
  private setupPhase2Listeners() {
    onSceneEvent(this.scene, 'player:attacked', (data) => {
      if (this.phase === 2) {
        this.counterAttack(data.direction);
      }
    });
  }
}
```

## Debugging Events

To debug event flow, you can add logging to the helper functions temporarily:

```typescript
export function emitSceneEvent<K extends keyof SceneEventMap>(
  scene: Phaser.Scene,
  event: K,
  data: SceneEventMap[K]
): void {
  console.log(`[EVENT] ${event}`, data); // Debug log
  scene.events.emit(event, data);
}
```

This helps trace event flow during development.