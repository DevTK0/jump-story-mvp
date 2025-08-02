import { createLogger, type ModuleLogger } from '@/core/logger';
import { PLAYER_CONFIG } from './config';

// Main player class
export { Player, type PlayerConfig } from './player';

// Player systems
export { InputSystem } from './input';
export { MovementSystem } from './movement/movement';
export { ClimbingSystem } from './movement/climbing';
export { AnimationSystem } from './animations';
export { DebugSystem } from '@/debug';
export { SyncManager, type SyncConfig } from './sync/sync-manager';
export {
  PlayerStateMachine,
  PlayerState,
  IdleState,
  WalkState,
  JumpState,
  ClimbingState,
  Attack1State,
  Attack2State,
  Attack3State,
  DamagedState,
  DeadState,
} from './state/state-machine';
// Teleport effect is now in the effects module

// Combat systems and services
export {
  CombatSystemEnhanced,
  DeathMonitor,
  DeathStateService,
  EnemyDamageRenderer,
  PlayerDamageRenderer,
  SkillEffectRenderer,
  PlayerHealEffectRenderer,
  DAMAGE_RENDERER_CONFIG,
  DAMAGE_COLOR_THEMES,
  getDamageTypeKey,
  getDamageDisplayText,
  getDamageStyle,
} from './combat';

interface Position {
  x: number
  y: number
}

declare global {
  var logger: ModuleLogger;
  var _defaultPosition: Position
  var _uiPosition: Position
}

globalThis.logger = createLogger('Global');
globalThis._defaultPosition = {
  x: PLAYER_CONFIG.respawn.spawnPosition.x,
  y: PLAYER_CONFIG.respawn.spawnPosition.y
};
globalThis._uiPosition = {
  x: -10000,
  y: -10000
};

// Effects
export { RespawnEffectRenderer } from './effects';

// Player services
export { PlayerQueryService } from './services/player-query-service';
export { CombatValidationService } from './services/combat-validation-service';
export {
  PositionReconciliationService,
  type PositionReconciliationConfig,
} from './movement/position-reconciliation-service';

// Builder pattern for flexible player creation
export { PlayerBuilder } from './player-builder';

// Type exports
export type { System } from '../core/types';
export * from './player-types';

// Export player constants
export { PLAYER_CONFIG } from './config';
