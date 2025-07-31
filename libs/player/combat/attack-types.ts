/**
 * Type-safe attack configuration system using discriminated unions
 */

// Valid attack modifiers
export type AttackModifier =
  | 'sword'
  | 'axe'
  | 'bow'
  | 'spear'
  | 'dark'
  | 'spike'
  | 'claw'
  | 'greatsword'
  | 'holy';

// Base attack properties shared by all attack types
interface BaseAttack {
  name: string;
  damage: number;
  cooldown: number;
  critChance: number;
  knockback: number;
  hits: number;
  range: number;
  targets: number;
  modifiers: AttackModifier[];
  manaCost: number;
  ammoCost: number;
  description: string;
  skillEffect?: string; // Optional VFX sprite key for on-hit effects
  icon?: string; // Optional icon sprite key for UI display
}

// Melee-specific properties
export interface StandardAttack extends BaseAttack {
  attackType: 'standard';
}

// Projectile-specific properties
export interface ProjectileAttack extends BaseAttack {
  attackType: 'projectile';
  projectile: string; // Required projectile sprite key
}

// Area-of-effect properties
export interface AreaAttack extends BaseAttack {
  attackType: 'area';
  radius: number;
  effectSprite: string;
}

// Dash attack properties
export interface DashAttack extends BaseAttack {
  attackType: 'dash';
  dashDistance: number;
  dashSpeed: number;
}

// Discriminated union - TypeScript will enforce correct fields based on attackType
export type Attack = StandardAttack | ProjectileAttack | AreaAttack | DashAttack;

// Passive ability interface
export interface Passive {
  name: string;
  description?: string;
}

// Type guards for runtime checking
export function isStandardAttack(attack: Attack): attack is StandardAttack {
  return attack.attackType === 'standard';
}

export function isProjectileAttack(attack: Attack): attack is ProjectileAttack {
  return attack.attackType === 'projectile';
}

export function isAreaAttack(attack: Attack): attack is AreaAttack {
  return attack.attackType === 'area';
}

export function isDashAttack(attack: Attack): attack is DashAttack {
  return attack.attackType === 'dash';
}

// Resistance values for different damage types
export interface Resistances {
  sword: number;
  axe: number;
  bow: number;
  spear: number;
  dark: number;
  spike: number;
  claw: number;
  greatsword: number;
}

// Example job configuration with type safety
export interface JobConfig {
  displayName: string;
  spriteKey: string;
  defaultUnlocked: boolean;
  baseStats: {
    health: number;
    moveSpeed: number;
    mana: number;
    hpRecovery: number;
    manaRecovery: number;
    resistances: Resistances;
  };
  attacks: {
    attack1: Attack;
    attack2: Attack;
    attack3: Attack;
  };
  passives: {
    passive1?: Passive;
    passive2?: Passive;
    passive3?: Passive;
  };
}

// Runtime validation function
export function validateAttackConfig(attack: any): attack is Attack {
  if (!attack.attackType || !attack.name || typeof attack.damage !== 'number') {
    return false;
  }

  switch (attack.attackType) {
    case 'standard':
      return true; // Standard attacks have no additional required fields
    case 'projectile':
      return !!attack.projectile; // Only requires projectile sprite key
    case 'area':
      return !!attack.radius;
    case 'dash':
      return !!(attack.dashDistance && attack.dashSpeed);
    default:
      return false;
  }
}
