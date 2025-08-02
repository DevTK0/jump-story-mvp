// Combat system and related types
export { CombatSystemEnhanced } from './combat-enhanced';
export { CombatMessageDisplay } from './combat-message-display';
export type { IHitValidator } from './hit-validator-interface';

// Death management
export { DeathMonitor } from './death-monitor';
export { DeathStateService } from './death-state-service';

// Damage visualization
export { EnemyDamageRenderer } from './enemy-damage-renderer';
export { PlayerDamageRenderer } from './player-damage-renderer';
export { ProjectileRenderer } from './projectile-renderer';
export { SkillEffectRenderer } from './skill-effect-renderer';
export { PlayerHealEffectRenderer } from './player-heal-effect-renderer';
export {
  DAMAGE_RENDERER_CONFIG,
  DAMAGE_COLOR_THEMES,
  getDamageTypeKey,
  getDamageDisplayText,
  getDamageStyle,
} from './damage-renderer-config';
export { PROJECTILE_RENDERER_CONFIG } from './projectile-renderer-config';
