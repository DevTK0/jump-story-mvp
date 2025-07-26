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
}

// Melee-specific properties
export interface StandardAttack extends BaseAttack {
  attackType: 'standard';
}

// Projectile-specific properties
export interface ProjectileAttack extends BaseAttack {
  attackType: 'projectile';
  projectileSpeed: number;
  projectileSize: number;
  projectileSprite: string;
}

// Area-of-effect properties
export interface AreaAttack extends BaseAttack {
  attackType: 'area';
  radius: number;
  effectSprite: string;
}

// Discriminated union - TypeScript will enforce correct fields based on attackType
export type Attack = StandardAttack | ProjectileAttack | AreaAttack;

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

// Example class configuration with type safety
export interface ClassConfig {
  displayName: string;
  spriteKey: string;
  baseStats: {
    health: number;
    moveSpeed: number;
    mana?: number;
  };
  attacks: {
    attack1: Attack;
    attack2: Attack;
    attack3: Attack;
  };
}

// Example usage showing TypeScript enforcement
export const EXAMPLE_WARRIOR_CONFIG: ClassConfig = {
  displayName: 'Warrior',
  spriteKey: 'warrior',
  baseStats: {
    health: 120,
    moveSpeed: 160,
  },
  attacks: {
    attack1: {
      attackType: 'standard',
      name: 'Quick Slash',
      damage: 10,
      cooldown: 300,
      critChance: 0.15,
      knockback: 5,
      range: 10,
      hits: 1,
    },
    attack2: {
      attackType: 'standard',
      name: 'Heavy Strike',
      damage: 25,
      cooldown: 800,
      critChance: 0.25,
      knockback: 15,
      range: 10,
      hits: 1,
    },
    attack3: {
      attackType: 'area',
      name: 'Ground Slam',
      damage: 20,
      cooldown: 1200,
      critChance: 0.1,
      range: 10,
      hits: 1,
      knockback: 15,
      radius: 1000,
      effectSprite: 'groundSlam',
    },
  },
};

// Example showing TypeScript errors
export const INVALID_CONFIG_EXAMPLE = {
  attack1: {
    attackType: 'melee',
    name: 'Bad Attack',
    damage: 10,
    cooldown: 300,
    critChance: 0.15,
    // TypeScript ERROR: 'projectileSpeed' does not exist on MeleeAttack
    // projectileSpeed: 300,

    // TypeScript ERROR: Missing required melee fields
    // hitboxShape, hitboxOffset, hitboxSize
  },
};

// Runtime validation function
export function validateAttackConfig(attack: any): attack is Attack {
  if (!attack.attackType || !attack.name || typeof attack.damage !== 'number') {
    return false;
  }

  switch (attack.attackType) {
    case 'melee':
      return !!(attack.hitboxShape && attack.hitboxOffset && attack.hitboxSize);
    case 'projectile':
      return !!(attack.projectileSpeed && attack.projectileSize && attack.projectileSprite);
    case 'area':
      return !!(attack.areaShape && attack.areaSize);
    default:
      return false;
  }
}
