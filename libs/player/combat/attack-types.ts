/**
 * Type-safe attack configuration system using discriminated unions
 */

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
  manaCost: number;
  manaLeech?: number; // Optional: Mana restored per enemy hit
  hpLeech?: number; // Optional: HP restored per enemy hit
  description: string;
  skillEffect?: string; // Optional VFX sprite key for on-hit effects
  icon?: string; // Optional icon sprite key for UI display
  audio?: string; // Optional audio file for skill sound effect
}

// Melee-specific properties
export interface StandardAttack extends BaseAttack {
  attackType: 'standard';
}

export interface StationaryAttack extends BaseAttack {
  attackType: 'stationary';
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

// Heal attack properties
export interface HealAttack extends BaseAttack {
  attackType: 'heal';
}

// Discriminated union - TypeScript will enforce correct fields based on attackType
export type Attack = StandardAttack | ProjectileAttack | AreaAttack | DashAttack | HealAttack | StationaryAttack;

// Type guards for runtime checking
export function isStandardAttack(attack: Attack): attack is StandardAttack {
  return attack.attackType === 'standard';
}
export function isStationaryAttack(attack: Attack): attack is StationaryAttack {
  return attack.attackType === 'stationary';
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

export function isHealAttack(attack: Attack): attack is HealAttack {
  return attack.attackType === 'heal';
}

// Example job configuration with type safety
export interface JobConfig {
  displayName: string;
  spriteKey: string;
  unlockLevel: number; // Level required to unlock (0 = unlocked by default)
  baseStats: {
    health: number;
    moveSpeed: number;
    mana: number;
    hpRecovery: number;
    manaRecovery: number;
    knockbackImmune?: boolean; // Optional: Makes the job immune to knockback
    doubleJump?: boolean; // Optional: Allows job to double jump
  };
  attacks: {
    attack1: Attack;
    attack2: Attack;
    attack3: Attack;
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
    case 'heal':
      return true; // Heal attacks have no additional required fields
    default:
      return false;
  }
}
