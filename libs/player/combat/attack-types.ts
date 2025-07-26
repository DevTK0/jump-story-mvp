/**
 * Type-safe attack configuration system using discriminated unions
 */

// Valid attack modifiers
export type AttackModifier = 'sword' | 'axe' | 'bow' | 'spear' | 'dark' | 'spike' | 'claw' | 'greatsword' | 'holy';

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

// Passive ability interface
export interface Passive {
  name: string;
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
    passive1: Passive;
  };
}

// Example usage showing TypeScript enforcement
export const EXAMPLE_WARRIOR_CONFIG: JobConfig = {
  displayName: 'Warrior',
  spriteKey: 'warrior',
  baseStats: {
    health: 120,
    moveSpeed: 160,
    mana: 50,
    hpRecovery: 1,
    manaRecovery: 0.5,
    resistances: {
      sword: 10,
      axe: 5,
      bow: -10,
      spear: 0,
      dark: -5,
      spike: 0,
      claw: -5,
      greatsword: 15,
    },
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
      targets: 1,
      modifiers: ['sword'],
      manaCost: 0,
      ammoCost: 0,
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
      targets: 1,
      modifiers: ['sword'],
      manaCost: 5,
      ammoCost: 0,
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
      targets: 3,
      modifiers: ['holy'],
      manaCost: 10,
      ammoCost: 0,
      radius: 1000,
      effectSprite: 'groundSlam',
    },
  },
  passives: {
    passive1: {
      name: 'Warrior\'s Resolve',
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
