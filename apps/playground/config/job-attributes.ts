import type { JobConfig } from '@/player/combat/attack-types';

const _knockback = {
  meleeAttack1: 10,
  meleeAttack2: 30,
  meleeAttack3: 2,
  meleeUltimate: 40, // Very knockback
  rangedAttack1: 5,
  rangedAttack2: 10,
  rangedAttack3: 5,
  rangedHeavyAttack2: 15,
  dashAttack: 30, // very knockback
  rangedUltimate: 30, // very knockback
}

// Shared attack configuration for all jobs
const sharedAttacks = {
  attack1: {
    attackType: 'standard' as const,
    name: 'Quick Strike',
    description:
      'A swift blade attack that deals moderate damage to nearby enemies. Low cooldown allows for rapid strikes.',
    damage: 10,
    cooldown: 0.5,
    critChance: 0,
    knockback: _knockback.meleeAttack1,
    range: 50,
    hits: 1,
    targets: 5,
    manaCost: 0,
    manaLeech: 3, // Default mana leech for basic attack
    hpLeech: 2, // Default HP leech for basic attack
    icon: 'slash1',
    audio: 'p_att_phys',
  },
  attack2: {
    attackType: 'standard' as const,
    name: 'Power Slash',
    description:
      'A devastating overhead swing that cleaves through multiple foes. Deals heavy damage with minimal knockback.',
    damage: 30,
    cooldown: 0.5,
    critChance: 0,
    knockback: _knockback.meleeAttack2,
    range: 75,
    hits: 1,
    targets: 6,
    manaCost: 10,
    icon: 'slash2',
    audio: 'p_att_phys',
  },
  attack3: {
    attackType: 'standard' as const,
    name: 'Ultimate Slash',
    description: 'An attack that gathers all power into one devestating blow.',
    damage: 50,
    cooldown: 0.5,
    critChance: 1,
    knockback: _knockback.meleeUltimate,
    range: 75,
    hits: 1,
    targets: 100,
    manaCost: 10,
    icon: 'slash3',
    audio: 'p_att_phys',
  },
};

export const jobAttributes: Record<string, JobConfig> = {
  soldier: {
    displayName: 'Soldier',
    spriteKey: 'soldier',
    unlockLevel: 0, // Unlocked by default
    baseStats: {
      health: 120000,
      moveSpeed: 250,
      mana: 30,
      hpRecovery: 1,
      knockbackImmune: true, // immune to knockback
      manaRecovery: 0.5,
    },
    attacks: {
      attack1: {
        attackType: 'standard' as const,
        name: 'Quick Strike',
        description:
          'A swift blade attack that deals moderate damage to nearby enemies. Low cooldown allows for rapid strikes.',
        damage: 10,
        cooldown: 0.5,
        critChance: 0,
        knockback: _knockback.meleeAttack1,
        range: 50,
        hits: 1,
        targets: 5,
        manaCost: 0,
        manaLeech: 3, // Moderate mana leech for soldier
        hpLeech: 3, // Higher HP leech for tank class
        icon: 'slash1',
        audio: 'p_att_phys',
      },
      attack2: {
        attackType: 'projectile' as const,
        name: 'Rapid Shot',
        description:
          'Fires an arrows rapidly.',
        damage: 10,
        cooldown: 0.5,
        critChance: 1,
        knockback: _knockback.rangedAttack1,
        range: 500,
        hits: 1,
        targets: 1,
        manaCost: 1,
        projectile: 'arrow', // Test projectile for soldier
        icon: 'arrow2',
        audio: 'p_att_phys',
      },
      attack3: {
        attackType: 'standard' as const,
        name: 'Power Slash',
        description:
          'A devastating overhead swing that cleaves through multiple foes. Deals heavy damage with minimal knockback.',
        damage: 50,
        cooldown: 5,
        critChance: 0,
        knockback: _knockback.meleeUltimate,
        range: 30,
        hits: 1,
        targets: 6,
        manaCost: 10,
        icon: 'slash3',
        audio: 'p_att_phys',
      },
    },
  },
  knight: {
    displayName: 'Knight',
    spriteKey: 'knight',
    unlockLevel: 0, // Unlock at level 2
    baseStats: {
      health: 150,
      moveSpeed: 200,
      mana: 50,
      hpRecovery: 1.5,
      manaRecovery: 0.3,
      knockbackImmune: true, // immune to knockback
    },
    attacks: {
      attack1: {
        ...sharedAttacks.attack1,
        range: 50,
      },
      attack2: {
        ...sharedAttacks.attack2,
        range: 75,
        manaCost: 10,
        damage: 30,
      },
      attack3: {
        ...sharedAttacks.attack3,
        name: 'Blazing Slash',
        description: 'An attack embedded in powerful flames.',
        icon: 'fire_sword',
        range: 100,
        manaCost: 20,
        damage: 50,
        targets: 100,
        hits: 1,
      },

    }
  },
  wizard: {
    displayName: 'Wizard',
    spriteKey: 'wizard',
    unlockLevel: 0, // Unlock at level 10
    baseStats: {
      health: 100,
      moveSpeed: 250,
      mana: 100,
      hpRecovery: 0.5,
      manaRecovery: 2,
    },
    attacks: {
      attack1: {
        attackType: 'casting' as const,
        name: 'Frost Nova',
        description: 'Channel frost magic to create a freezing explosion in front of you.',
        damage: 15,
        cooldown: 0.6,
        critChance: 0.2,
        knockback: _knockback.rangedAttack1,
        range: 150,
        radius: 150,
        effectSprite: 'freeze',
        hits: 1,
        targets: 1,
        manaCost: 0,
        manaLeech: 5, // Low mana leech for wizard, relies on high mana regen
        hpLeech: 1, // Very low HP leech for magic users
        skillEffect: 'freeze',
        icon: 'ice1',
        audio: 'p_att_ice',
      },
      attack2: {
        attackType: 'projectile' as const,
        name: 'Fire Bolt',
        description: 'Channel fire magic to shoot a fireball in front of you.',
        damage: 40,
        cooldown: 0.8,
        critChance: 0.15,
        knockback: _knockback.rangedAttack2,
        range: 300,
        hits: 1,
        targets: 1,
        manaCost: 10,
        projectile: 'fireball',
        skillEffect: 'fire-explosion',
        icon: 'fire1',
        audio: 'p_att_fire',
      },
      attack3: {
        attackType: 'casting' as const,
        name: 'Fire Explosion',
        description: 'Channel fire magic to create a large explosion of fire.',
        damage: 25,
        cooldown: 1.0,
        critChance: 0.3,
        knockback: _knockback.rangedUltimate,
        range: 300,
        radius: 300,
        effectSprite: 'fire',
        hits: 1,
        targets: 10,
        manaCost: 100,
        projectile: 'fireball',
        skillEffect: 'fire-explosion',
        icon: 'fire2',
        audio: 'p_att_fire',
      },
    },
  },
  archer: {
    displayName: 'Archer',
    spriteKey: 'archer',
    unlockLevel: 0, // Unlocked by default
    baseStats: {
      health: 60,
      moveSpeed: 250,
      mana: 40,
      hpRecovery: 0.8,
      manaRecovery: 0.8,
      doubleJump: true,
    },
    attacks: {
      attack1: {
        attackType: 'projectile' as const,
        name: 'Quick Shot',
        description:
          'A swift arrow shot that deals moderate damage at range. Low cooldown for rapid fire.',
        damage: 12,
        cooldown: 0.4,
        critChance: 0.15,
        knockback: _knockback.rangedAttack1,
        range: 300,
        hits: 1,
        targets: 1,
        manaCost: 0,
        manaLeech: 2, // Low mana leech for ranged combat
        hpLeech: 1, // Low HP leech for ranged classes
        projectile: 'arrow',
        icon: 'arrow1',
        audio: 'p_att_phys',
      },
      attack2: {
        attackType: 'projectile' as const,
        name: 'Power Shot',
        description: 'A charged arrow that pierces through enemies dealing heavy damage.',
        damage: 35,
        cooldown: 0.8,
        critChance: 0.25,
        knockback: 600,
        range: 400,
        hits: 1,
        targets: 3,
        manaCost: 0,
        projectile: 'arrow',
        icon: 'arrow2',
        audio: 'p_att_phys',
      },
      attack3: {
        attackType: 'projectile' as const,
        name: 'Rain of Arrows',
        description: 'Unleash multiple arrows in a wide arc, hitting all enemies in front.',
        damage: 20,
        cooldown: 1.2,
        critChance: 0.1,
        knockback: 200,
        range: 350,
        hits: 3,
        targets: 5,
        manaCost: 0,
        projectile: 'arrow',
        icon: 'arrow3',
        audio: 'p_att_phys',
      },
    },
  },
  'armored-axeman': {
    displayName: 'Armored Axeman',
    spriteKey: 'armored-axeman',
    unlockLevel: 0, // Unlock at level 15
    baseStats: {
      health: 180,
      moveSpeed: 175,
      mana: 40,
      hpRecovery: 1.2,
      manaRecovery: 0.4,
      knockbackImmune: true, // immune to knockback
    },
    attacks: sharedAttacks,
  },
  'knight-templar': {
    displayName: 'Knight Templar',
    spriteKey: 'knight-templar',
    unlockLevel: 0, // Unlock at level 20
    baseStats: {
      health: 200,
      moveSpeed: 150,
      mana: 80,
      hpRecovery: 2,
      manaRecovery: 1,
      knockbackImmune: true, // immune to knockback
    },
    attacks: {
      ...sharedAttacks,
      attack1: {
        ...sharedAttacks.attack1,
        attackType: 'standard' as const,
      },
      attack3: {
        attackType: 'dash' as const,
        name: 'Shield Charge',
        description: 'Dashes forward while holding up the shield.',
        damage: 25,
        cooldown: 1.2,
        critChance: 0.3,
        knockback: 20,
        range: 200,
        hits: 2,
        targets: 3,
        manaCost: 0,
        dashDistance: 1000,
        dashSpeed: 1000,
        icon: 'shield1',
        audio: 'p_att_phys'
      },
    },
  },
  lancer: {
    displayName: 'Lancer',
    spriteKey: 'lancer',
    unlockLevel: 0, // Unlocked by default
    baseStats: {
      health: 150,
      moveSpeed: 400, // Really fast movement speed
      mana: 50,
      hpRecovery: 1,
      manaRecovery: 0.7,
      knockbackImmune: true, // immune to knockback
    },
    attacks: {
      attack1: {
        ...sharedAttacks.attack1,
        attackType: 'standard' as const,
      },
      attack2: {
        attackType: 'dash' as const,
        description: 'A dash that uses the full speed of the steed.',
        name: 'Piercing Dash',
        damage: 40,
        cooldown: 0.8,
        critChance: 0.15,
        knockback: 15,
        range: 100,
        hits: 1,
        targets: 10,
        manaCost: 0,
        dashDistance: 300,
        dashSpeed: 800,
        icon: 'charge1',
        audio: 'p_att_phys',
      },
      attack3: {
        attackType: 'dash' as const,
        name: 'Lightning Thrust',
        description: 'A lightning-enhanced attack while dashing on the trusty steed.',
        damage: 25,
        cooldown: 1.2,
        critChance: 0.3,
        knockback: 20,
        range: 100,
        hits: 2,
        targets: 10,
        manaCost: 0,
        dashDistance: 1000,
        dashSpeed: 1000,
        icon: 'lightning2',
        audio: 'p_att_phys',
      },
    },
  },
  priest: {
    displayName: 'Priest',
    spriteKey: 'priest',
    unlockLevel: 0, // Unlock at level 8
    baseStats: {
      health: 85,
      moveSpeed: 250,
      mana: 120,
      hpRecovery: 1.5,
      manaRecovery: 2.5,
    },
    attacks: {
      attack1: sharedAttacks.attack1,
      attack2: {
        attackType: 'heal' as const,
        name: 'Heal',
        description: 'Restore health to nearby party members with divine healing power.',
        damage: 50, // Used as heal amount
        cooldown: 2.0,
        critChance: 0,
        knockback: 0,
        range: 200,
        hits: 1,
        targets: 3, // Can heal up to 3 party members
        manaCost: 20,
        skillEffect: 'freeze',
        icon: 'heal1',
        audio: 'p_att_heal',
      },
      attack3: sharedAttacks.attack3,
    },
  },
  swordsman: {
    displayName: 'Hero',
    spriteKey: 'swordsman',
    unlockLevel: 0, // Unlocked by default
    baseStats: {
      health: 105,
      moveSpeed: 300,
      mana: 40,
      hpRecovery: 1,
      manaRecovery: 0.6,
      doubleJump: true,
    },
    attacks: sharedAttacks,
  },
};

// Export a default object for compatibility with existing imports
export default { jobs: jobAttributes };
