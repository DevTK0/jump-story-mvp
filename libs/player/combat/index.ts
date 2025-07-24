// Combat system and related types
export { CombatSystem, type AttackConfig } from './combat';

// Death management
export { DeathMonitor } from './death-monitor';
export { DeathStateService } from './death-state-service';

// Damage visualization
export { DamageNumberRenderer } from './damage-number-renderer';
export { DAMAGE_NUMBER_CONFIG, getDamageTypeKey, getDamageDisplayText } from './damage-number-config';