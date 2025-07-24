// Main player class
export { Player, type PlayerConfig } from './player';

// Player systems
export { InputSystem } from './input';
export { MovementSystem } from './movement/movement';
export { ClimbingSystem } from './movement/climbing';
export { AnimationSystem } from './animations';
export { DebugSystem } from '@/debug';
export { SyncManager, type SyncConfig } from './sync-manager';
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
    DeadState
} from './state-machine';
// Teleport effect is now in the effects module

// Combat systems and services
export { 
    CombatSystem, 
    type AttackConfig,
    DeathMonitor,
    DeathStateService,
    EnemyDamageRenderer,
    PlayerDamageRenderer,
    DAMAGE_RENDERER_CONFIG,
    DAMAGE_COLOR_THEMES,
    getDamageTypeKey,
    getDamageDisplayText,
    getDamageStyle
} from './combat';

// Player services
export { PlayerQueryService } from './player-query-service';
export { PositionReconciliationService, type PositionReconciliationConfig } from './movement/position-reconciliation-service';

// Builder pattern for flexible player creation
export { PlayerBuilder } from './player-builder';

// Legacy factory function - maintained for backward compatibility
import { Player, type PlayerConfig } from './player';
import { PlayerBuilder } from './player-builder';
import type { AttackConfig } from './combat/combat';

export interface PlayerFactoryConfig extends PlayerConfig {
  attackConfig?: AttackConfig;
}

/**
 * @deprecated Use PlayerBuilder for more flexible player creation.
 * This function is maintained for backward compatibility.
 */
export function createPlayer(config: PlayerFactoryConfig): Player {
  // Use the new builder pattern internally while maintaining the same API
  const builder = new PlayerBuilder(config.scene)
    .setPosition(config.x, config.y)
    .setTexture(config.texture, config.frame)
    .withAllSystems(); // Maintain full-system behavior for backward compatibility
  
  if (config.attackConfig) {
    builder.withCombat(config.attackConfig);
  }
  
  return builder.build();
}

// Type exports
export type { System } from '../core/types';
export * from './player-types';
export * from './player-events';

// Export player constants
export { PLAYER_CONFIG } from './config';