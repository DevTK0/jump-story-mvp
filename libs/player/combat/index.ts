// Combat system and related types
export { CombatSystem, type AttackConfig } from './combat';
export { CombatSystemEnhanced } from './combat-enhanced';
export { CombatMessageDisplay } from './combat-message-display';

// Death management
export { DeathMonitor } from './death-monitor';
export { DeathStateService } from './death-state-service';

// Damage visualization
export { EnemyDamageRenderer } from './enemy-damage-renderer';
export { PlayerDamageRenderer } from './player-damage-renderer';
export {
  DAMAGE_RENDERER_CONFIG,
  DAMAGE_COLOR_THEMES,
  getDamageTypeKey,
  getDamageDisplayText,
  getDamageStyle,
} from './damage-renderer-config';
