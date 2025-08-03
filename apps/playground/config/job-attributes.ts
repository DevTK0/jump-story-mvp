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
  heal: 0,
};

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
        attackType: 'standard' as const,
        name: 'Wide Sweep',
        description: 'A wide sweeping attack that hits multiple enemies.',
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
        name: 'Power Slash',
        description:
          'A devastating overhead swing that cleaves through multiple foes. Deals heavy damage with minimal knockback.',
        damage: 100,
        cooldown: 5,
        critChance: 0,
        knockback: _knockback.meleeUltimate,
        range: 30,
        hits: 1,
        targets: 3,
        manaCost: 10,
        icon: 'slash3',
        audio: 'p_att_phys',
      },
    },
  },
  knight: {
    displayName: 'Knight',
    spriteKey: 'knight',
    unlockLevel: 10, // Unlock at level 10
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
        damage: 15,
        hits: 2,
      },
      attack3: {
        ...sharedAttacks.attack3,
        name: 'Blazing Slash',
        description: 'An attack embedded in powerful flames.',
        icon: 'fire_sword',
        range: 100,
        manaCost: 15,
        cooldown: 8.0,
        damage: 100,
        targets: 3,
        hits: 1,
      },
    },
  },
  wizard: {
    displayName: 'Wizard',
    spriteKey: 'wizard',
    unlockLevel: 15, // Unlock at level 15
    baseStats: {
      health: 100,
      moveSpeed: 250,
      mana: 100,
      hpRecovery: 0.5,
      manaRecovery: 2,
    },
    attacks: {
      attack1: {
        attackType: 'area' as const,
        name: 'Frost Nova',
        description: 'Channel frost magic to create a freezing explosion in front of you.',
        damage: 10,
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
        attackType: 'area' as const,
        name: 'Fire Explosion',
        description: 'Channel fire magic to create an explosion of fire.',
        damage: 30,
        cooldown: 0.8,
        critChance: 0.15,
        knockback: _knockback.rangedAttack2,
        range: 300,
        hits: 1,
        targets: 10,
        manaCost: 10,
        skillEffect: 'fire-explosion',
        icon: 'fire1',
        audio: 'p_att_fire',
      },
      attack3: {
        attackType: 'area' as const,
        name: 'Meteor Storm',
        description: 'Channel fire magic to rain down meteors.',
        damage: 80,
        cooldown: 8.0,
        critChance: 0.3,
        knockback: _knockback.rangedUltimate,
        range: 300,
        radius: 300,
        effectSprite: 'fire',
        hits: 1,
        targets: 10,
        manaCost: 100,
        skillEffect: 'fire-explosion',
        icon: 'fire2',
        audio: 'p_att_fire',
      },
    },
  },
  archer: {
    displayName: 'Archer',
    spriteKey: 'archer',
    unlockLevel: 75, // Unlock at level 75
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
        damage: 8,
        cooldown: 0,
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
        name: 'Multi Shot',
        description: 'Fire multiple arrows in rapid succession.',
        damage: 10,
        cooldown: 0,
        critChance: 0.25,
        knockback: _knockback.rangedAttack2,
        range: 400,
        hits: 3,
        targets: 3,
        manaCost: 10,
        projectile: 'arrow',
        icon: 'arrow2',
        audio: 'p_att_phys',
      },
      attack3: {
        attackType: 'projectile' as const,
        name: 'Power Shot',
        description: 'A powerful shot that pierces through enemies.',
        damage: 60,
        cooldown: 8.0,
        critChance: 0.1,
        knockback: _knockback.rangedUltimate,
        range: 350,
        hits: 2,
        targets: 2,
        manaCost: 20,
        projectile: 'arrow',
        icon: 'arrow3',
        audio: 'p_att_phys',
      },
    },
  },
  'armored-axeman': {
    displayName: 'Armored Axeman',
    spriteKey: 'armored-axeman',
    unlockLevel: 55, // Unlock at level 55
    baseStats: {
      health: 180,
      moveSpeed: 175,
      mana: 40,
      hpRecovery: 1.2,
      manaRecovery: 0.4,
      knockbackImmune: true, // immune to knockback
    },
    attacks: {
      attack1: {
        ...sharedAttacks.attack1,
        damage: 10,
      },
      attack2: {
        attackType: 'area' as const,
        name: 'Whirlwind',
        description: 'Spin your axe in a wide arc, hitting all nearby enemies.',
        damage: 35,
        cooldown: 0.5,
        critChance: 0,
        knockback: _knockback.meleeAttack2,
        range: 100,
        radius: 100,
        hits: 1,
        targets: 8,
        manaCost: 10,
        skillEffect: 'whirlwind',
        icon: 'axe2',
        audio: 'p_att_phys',
      },
      attack3: {
        ...sharedAttacks.attack3,
        damage: 120,
        targets: 2,
      },
    },
  },
  'knight-templar': {
    displayName: 'Knight Templar',
    spriteKey: 'knight-templar',
    unlockLevel: 40, // Unlock at level 40
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
        damage: 10,
      },
      attack2: {
        ...sharedAttacks.attack2,
        damage: 15,
        hits: 2,
        targets: 6,
      },
      attack3: {
        attackType: 'standard' as const,
        name: 'Holy Strike',
        description: 'A powerful strike infused with holy power.',
        damage: 80,
        cooldown: 5.0,
        critChance: 0,
        knockback: _knockback.meleeUltimate,
        range: 75,
        hits: 1,
        targets: 3,
        manaCost: 20,
        dashSpeed: 400,
        icon: 'shield1',
        audio: 'p_att_phys',
      },
    },
  },
  lancer: {
    displayName: 'Lancer',
    spriteKey: 'lancer',
    unlockLevel: 25, // Unlock at level 25
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
        damage: 10,
      },
      attack2: {
        attackType: 'dash' as const,
        description: 'A dash that uses the full speed of the steed.',
        name: 'Piercing Dash',
        damage: 30,
        cooldown: 0.8,
        critChance: 0,
        knockback: _knockback.dashAttack,
        range: 100,
        hits: 1,
        targets: 8,
        manaCost: 10,
        dashSpeed: 500,
        icon: 'charge1',
        audio: 'p_att_phys',
      },
      attack3: {
        attackType: 'dash' as const,
        name: 'Lightning Thrust',
        description: 'A lightning-enhanced attack while dashing on the trusty steed.',
        damage: 100,
        cooldown: 8.0,
        critChance: 0,
        knockback: _knockback.dashAttack,
        range: 100,
        hits: 1,
        targets: 2,
        manaCost: 20,
        dashSpeed: 600,
        icon: 'lightning2',
        audio: 'p_att_phys',
      },
    },
  },
  priest: {
    displayName: 'Priest',
    spriteKey: 'priest',
    unlockLevel: 5, // Unlock at level 5
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
        knockback: _knockback.heal,
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
    displayName: 'Swordmaster',
    spriteKey: 'swordsman',
    unlockLevel: 90, // Unlock at level 90
    baseStats: {
      health: 105,
      moveSpeed: 300,
      mana: 40,
      hpRecovery: 1,
      manaRecovery: 0.6,
      doubleJump: true,
    },
    attacks: {
      attack1: {
        ...sharedAttacks.attack1,
        damage: 10,
        critChance: 1.0, // Guaranteed crit
      },
      attack2: {
        ...sharedAttacks.attack2,
        damage: 10,
        hits: 3,
        critChance: 0.5,
        targets: 6,
      },
      attack3: {
        ...sharedAttacks.attack3,
        damage: 50,
        hits: 2,
        critChance: 1.0, // Guaranteed crit
        targets: 2,
      },
    },
  },
};

// Export a default object for compatibility with existing imports
export default { jobs: jobAttributes };
