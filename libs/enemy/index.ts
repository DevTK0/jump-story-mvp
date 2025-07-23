// Export all enemy-related components
export { Enemy, type EnemyConfig, DEFAULT_ENEMY_CONFIG } from './enemy';
export { EnemyManager } from './enemy-manager';
export { EnemyStateManager, type EnemyStateService } from './enemy-state-service';

// Export enemy constants and configuration
export { ENEMY_CONFIG, type EnemyType, type EnemyAnimationType, getEnemyTypeConfig, isValidEnemyType } from './enemy-config';

// Type exports
export * from './enemy-types';
export * from './enemy-events';