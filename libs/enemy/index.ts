// Export all enemy-related components
export { Enemy, type EnemyConfig, DEFAULT_ENEMY_CONFIG } from './enemy';
export { EnemyManager } from './enemy-manager';
export { EnemyStateManager, type EnemyStateService } from './state/enemy-state-service';
export { EnemyStateMachine, EnemyState, EnemyIdleState, EnemyWalkState, EnemyDamagedState, EnemyDeadState } from './state/enemy-state-machine';

// Export enemy constants and configuration
export { ENEMY_CONFIG, type EnemyType, type EnemyAnimationType, getEnemyTypeConfig, isValidEnemyType } from './config/enemy-config';

// Type exports
export * from './enemy-types';
export * from './enemy-events';