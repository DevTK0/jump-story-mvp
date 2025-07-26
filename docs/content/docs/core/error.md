---
title: Error
---

```d2 layout="elk"
ErrorBoundary: {
    shape: class
    +getInstance(): ErrorBoundary
    +handleError(error, context?)
    +wrap(fn, context): Function
    +registerRecoveryStrategy(name, strategy)
    +registerErrorHandler(name, handler)
    +unregisterErrorHandler(name)
    -attemptRecovery(error): Promise
    -logError(error)
    -notifyHandlers(error)
    -addToHistory(error)
    -reloadGame()
}

GameError: {
    shape: class
    +severity: ErrorSeverity
    +context?: ErrorContext
    +timestamp: number
}

ErrorRecoveryStrategy: {
    shape: class
    +canRecover(error, context): boolean
    +recover(error, context): Promise
}

SceneErrorHandler: {
    shape: class
    +protectScene(scene)
    -wrapLifecycleMethods(scene, context)
    -wrapUpdateMethods(scene, context)
    -createRateLimitedWrapper(fn, context): Function
}

AssetError: {
    shape: class
}

NetworkError: {
    shape: class
}

SceneError: {
    shape: class
}

PlayerStateRecoveryStrategy: {
    shape: class
}

EnemySystemRecoveryStrategy: {
    shape: class
}

PhysicsRecoveryStrategy: {
    shape: class
}

GameError -> Error: extends
AssetError -> GameError: extends
NetworkError -> GameError: extends
SceneError -> GameError: extends
ErrorBoundary -> GameError: creates
ErrorBoundary -> ErrorRecoveryStrategy: uses
PlayerStateRecoveryStrategy -> ErrorRecoveryStrategy: implements
EnemySystemRecoveryStrategy -> ErrorRecoveryStrategy: implements
PhysicsRecoveryStrategy -> ErrorRecoveryStrategy: implements
SceneErrorHandler -> ErrorBoundary: uses
```

The error system provides comprehensive error handling and recovery for the game. It uses a centralized ErrorBoundary singleton to manage all errors, with automatic recovery strategies, severity-based handling, and graceful degradation to ensure the game remains playable even when errors occur.

## Components

### ErrorBoundary

Central singleton that manages all error handling in the game. Provides global error catching, logging, recovery attempts, and error history management.

**Key features:**

- Global error and promise rejection handlers
- Severity-based error handling (LOW, MEDIUM, HIGH, CRITICAL)
- Error history tracking (max 100 entries)
- Recovery strategy registration and execution
- Method wrapping for automatic error handling
- Configurable error handlers for custom notifications

### GameError

Base error class for all game-specific errors. Extends JavaScript Error with additional context.

**Properties:**

- `severity`: Error severity level (ErrorSeverity enum)
- `context`: Optional error context with scene, system, action, and metadata
- `timestamp`: When the error occurred

### Error Types

**AssetError**: HIGH severity errors for asset loading failures

**NetworkError**: HIGH severity errors for network/connection issues

**SceneError**: MEDIUM severity errors for scene-related problems

**GameStateError**: MEDIUM severity errors for game state corruption

### SceneErrorHandler

Automatically protects Phaser scenes by wrapping lifecycle and update methods with error boundaries.

**Features:**

- Wraps init, preload, create methods
- Rate-limited error handling for update loops (1 second cooldown)
- Scene-specific error logging
- Prevents game freeze from update loop errors

### Recovery Strategies

**PlayerStateRecoveryStrategy**: Handles player state corruption
- Resets player physics
- Transitions state machine to Idle
- Triggers respawn if available

**EnemySystemRecoveryStrategy**: Handles enemy system failures
- Cleans up enemy references
- Re-establishes database connections
- Restarts enemy management

**PhysicsRecoveryStrategy**: Handles physics engine errors
- Pauses and resumes physics
- Clears stuck physics bodies
- Resets velocities and accelerations

## Usage

### Basic Error Handling

```ts
import { ErrorBoundary, AssetError } from '@/core/error';

// Get the singleton instance
const errorBoundary = ErrorBoundary.getInstance();

// Handle an error
errorBoundary.handleError(
  new AssetError('Failed to load sprite', {
    scene: this.scene,
    system: 'loader',
    action: 'load-sprite',
    metadata: { sprite: 'player.png' }
  })
);
```

### Using Error Decorators

```ts
import { SafeMethod, ContinueOnError, Critical, Retry } from '@/core/error';

class GameSystem {
  // Wrap method with error boundary
  @SafeMethod({ system: 'game-system' })
  processGameLogic(): void {
    // Errors are automatically caught and handled
  }

  // Continue execution on error
  @ContinueOnError({ 
    severity: ErrorSeverity.LOW,
    fallbackValue: [] 
  })
  loadOptionalData(): any[] {
    // Returns fallbackValue if error occurs
  }

  // Critical method with recovery
  @Critical({ recoveryStrategy: 'network' })
  async syncGameState(): Promise<void> {
    // Attempts recovery on failure
  }

  // Retry on failure
  @Retry({ attempts: 3, delay: 1000, backoff: true })
  async fetchLeaderboard(): Promise<Data> {
    // Retries up to 3 times with exponential backoff
  }
}
```

### Protecting a Scene

```ts
import { protectScene } from '@/core/error';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'game-scene' });
  }

  create(): void {
    // Protect this scene with error boundaries
    protectScene(this);
    
    // All lifecycle methods are now wrapped
    // Errors won't crash the game
  }
}
```

### Custom Recovery Strategy

```ts
import { ErrorRecoveryStrategy, ErrorBoundary } from '@/core/error';

class CustomRecoveryStrategy implements ErrorRecoveryStrategy {
  canRecover(error: Error, context: ErrorContext): boolean {
    return error.message.includes('custom-error');
  }

  async recover(error: Error, context: ErrorContext): Promise<void> {
    // Implement recovery logic
    console.log('Recovering from custom error');
    // Reset relevant systems
  }
}

// Register the strategy
const errorBoundary = ErrorBoundary.getInstance();
errorBoundary.registerRecoveryStrategy('custom', new CustomRecoveryStrategy());
```

## Integration

```d2 layout="elk"
AssetLoaderService -> ErrorBoundary: registers loaderror handler
SceneConnectionHelper -> ErrorBoundary: handles network errors
SceneErrorHandler -> ErrorBoundary: wraps scene methods
ErrorDecorators -> ErrorBoundary: delegates error handling

ErrorBoundary -> ErrorRecoveryStrategy: attempts recovery
ErrorBoundary -> Logger: logs by severity
ErrorBoundary -> ErrorHandlers: notifies registered handlers
ErrorBoundary -> Browser: reloads on critical failure

PlayerStateRecoveryStrategy -> Player: resets state
PlayerStateRecoveryStrategy -> RespawnSystem: triggers respawn
EnemySystemRecoveryStrategy -> EnemyManager: cleans up
PhysicsRecoveryStrategy -> PhysicsWorld: resets bodies
```

## Configuration

### Error Severity Levels

```ts
export enum ErrorSeverity {
  LOW = 'low',        // Log only, continue execution
  MEDIUM = 'medium',  // Log and notify user, continue
  HIGH = 'high',      // Log, notify, attempt recovery
  CRITICAL = 'critical' // Log, notify, reload if recovery fails
}
```

### Error Context

```ts
interface ErrorContext {
  scene?: Phaser.Scene;     // Current scene reference
  system?: string;          // System that generated error
  action?: string;          // Action being performed
  metadata?: Record<string, unknown>; // Additional context
}
```

### Default Configuration

- Error history limit: 100 entries
- Update loop error cooldown: 1000ms
- Global handlers: Enabled for uncaught errors and unhandled promises
- Recovery attempts: Sequential until one succeeds
- Critical error behavior: Reload game after 2 seconds