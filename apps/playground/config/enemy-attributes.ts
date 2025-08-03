// Hitbox size definitions
export type HitboxSize = 'small' | 'medium' | 'large';
export type BossHitboxSize = 'boss_small' | 'boss_medium' | 'boss_large';

export const HITBOX_SIZES = {
  small: { width: 8, height: 8 },
  medium: { width: 12, height: 12 },
  large: { width: 16, height: 16 },
  boss_small: { width: 16, height: 16 },
  boss_medium: { width: 20, height: 20 },
  boss_large: { width: 24, height: 24 },
} as const;

export interface EnemyAttribute {
  health: number;
  move_speed: number;
  damage: number;
  sprite: string;
  name: string;
  ai_behavior: 'patrol' | 'aggressive';
  aggro_range: number;
  level: number;
  exp_reward: number;
  hitbox_size?: HitboxSize; // Optional with 'medium' as default
  hitbox_offset?: { x: number; y: number }; // Optional offset for physics body positioning
  invulnerable?: boolean; // Optional: Makes the enemy immune to all damage
  boss_trigger?: {
    boss_to_spawn: string;
    required_kills: number;
  };
  audio?: {
    on_damaged?: string;
    on_death?: string;
  };
}

export interface EnemyAttributes {
  enemies: {
    [key: string]: EnemyAttribute;
  };
}

export const enemyAttributes: EnemyAttributes = {
  enemies: {
    orc: {
      health: 400,
      move_speed: 50,
      damage: 25,
      sprite: 'orc',
      name: 'Orc',
      ai_behavior: 'patrol',
      aggro_range: 150,
      level: 15,
      exp_reward: 300,
      hitbox_size: 'medium',
      boss_trigger: {
        boss_to_spawn: 'orc',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitFlesh',
        on_death: 'bossDeathGeneric',
      },
    },
    'armored-orc': {
      health: 1000,
      move_speed: 40,
      damage: 45,
      sprite: 'armored-orc',
      name: 'Armored Orc',
      ai_behavior: 'aggressive',
      aggro_range: 200,
      level: 25,
      exp_reward: 800,
      hitbox_size: 'medium',
      boss_trigger: {
        boss_to_spawn: 'armored-orc',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathGeneric',
      },
    },
    'elite-orc': {
      health: 20000,
      move_speed: 60,
      damage: 600,
      sprite: 'elite-orc',
      name: 'Elite Orc',
      ai_behavior: 'aggressive',
      aggro_range: 250,
      level: 80,
      exp_reward: 15000,
      hitbox_size: 'large',
      boss_trigger: {
        boss_to_spawn: 'elite-orc',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathGeneric',
      },
    },
    'orc-rider': {
      health: 12000,
      move_speed: 80,
      damage: 400,
      sprite: 'orc-rider',
      name: 'Orc Rider',
      ai_behavior: 'patrol',
      aggro_range: 300,
      level: 70,
      exp_reward: 10000,
      hitbox_size: 'large',
      boss_trigger: {
        boss_to_spawn: 'orc-rider',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathGeneric',
      },
    },
    skeleton: {
      health: 200,
      move_speed: 45,
      damage: 15,
      sprite: 'skeleton',
      name: 'Skeleton',
      ai_behavior: 'patrol',
      aggro_range: 150,
      level: 10,
      exp_reward: 150,
      hitbox_size: 'small',
      boss_trigger: {
        boss_to_spawn: 'skeleton',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitBone',
        on_death: 'bossDeathBone',
      },
    },
    'armored-skeleton': {
      health: 1500,
      move_speed: 35,
      damage: 60,
      sprite: 'armored-skeleton',
      name: 'Armored Skeleton',
      ai_behavior: 'aggressive',
      aggro_range: 180,
      level: 30,
      exp_reward: 1200,
      hitbox_size: 'medium',
      boss_trigger: {
        boss_to_spawn: 'armored-skeleton',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathBone',
      },
    },
    'skeleton-archer': {
      health: 600,
      move_speed: 50,
      damage: 35,
      sprite: 'skeleton-archer',
      name: 'Skeleton Archer',
      ai_behavior: 'patrol',
      aggro_range: 250,
      level: 20,
      exp_reward: 500,
      hitbox_size: 'small',
      boss_trigger: {
        boss_to_spawn: 'skeleton-archer',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitBone',
        on_death: 'bossDeathBone',
      },
    },
    'greatsword-skeleton': {
      health: 8000,
      move_speed: 30,
      damage: 250,
      sprite: 'greatsword-skeleton',
      name: 'Greatsword Skeleton',
      ai_behavior: 'aggressive',
      aggro_range: 200,
      level: 60,
      exp_reward: 6500,
      hitbox_size: 'large',
      boss_trigger: {
        boss_to_spawn: 'greatsword-skeleton',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitBone',
        on_death: 'bossDeathBone',
      },
    },
    slime: {
      health: 100,
      move_speed: 30,
      damage: 8,
      sprite: 'slime',
      name: 'Slime',
      ai_behavior: 'patrol',
      aggro_range: 100,
      level: 5,
      exp_reward: 80,
      hitbox_size: 'medium',
      boss_trigger: {
        boss_to_spawn: 'slime',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitSlime',
        on_death: 'bossDeathSlime',
      },
    },
    werewolf: {
      health: 3000,
      move_speed: 70,
      damage: 100,
      sprite: 'werewolf',
      name: 'Werewolf',
      ai_behavior: 'aggressive',
      aggro_range: 300,
      level: 40,
      exp_reward: 2500,
      hitbox_size: 'large',
      boss_trigger: {
        boss_to_spawn: 'werewolf',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitFlesh',
        on_death: 'bossDeathGeneric',
      },
    },
    werebear: {
      health: 5000,
      move_speed: 50,
      damage: 150,
      sprite: 'werebear',
      name: 'Werebear',
      ai_behavior: 'aggressive',
      aggro_range: 250,
      level: 50,
      exp_reward: 4000,
      hitbox_size: 'large',
      boss_trigger: {
        boss_to_spawn: 'werebear',
        required_kills: 1000,
      },
      audio: {
        on_damaged: 'bossHitFlesh',
        on_death: 'bossDeathGeneric',
      },
    },
    'super-slime': {
      health: 40,
      move_speed: 30,
      damage: 5,
      sprite: 'slime',
      name: 'Slime',
      ai_behavior: 'patrol',
      aggro_range: 100,
      level: 1,
      exp_reward: 10,
      invulnerable: true,
      hitbox_size: 'medium',
    },
  },
};

export interface BossAttack {
  attackType: 'directional' | 'area' | 'summon';
  damage: number;
  cooldown: number;
  knockback: number;
  range: number;
  hits: number;
  projectile?: string | null;
  skillEffect?: string;
  icon?: string;
}

export interface BossAttribute {
  health: number;
  move_speed: number;
  damage: number;
  sprite: string;
  name: string;
  ai_behavior: 'patrol' | 'aggressive';
  aggro_range: number;
  level: number;
  exp_reward: number;
  hitbox_size?: BossHitboxSize; // Optional with 'boss_medium' as default
  hitbox_offset?: { x: number; y: number }; // Optional offset for physics body positioning
  attacks?: {
    attack1?: BossAttack;
    attack2?: BossAttack;
    attack3?: BossAttack;
  };
  audio?: {
    on_damaged?: string;
    on_death?: string;
    attack1?: string;
    attack2?: string;
    attack3?: string;
  };
}

export interface BossAttributes {
  bosses: {
    [key: string]: BossAttribute;
  };
}

export const bossAttributes: BossAttributes = {
  bosses: {
    'orc-rider': {
      health: 250000,
      move_speed: 100,
      damage: 800,
      sprite: 'orc-rider',
      name: 'Orc Warlord',
      ai_behavior: 'aggressive',
      aggro_range: 500,
      level: 80,
      exp_reward: 250000,
      hitbox_size: 'boss_large',
      hitbox_offset: { x: 0, y: -5 }, // Offset from centered position
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathGeneric',
        attack1: 'bossAttackPhys',
        attack2: 'bossAttackGeneric',
        attack3: 'bossAttackGeneric',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 200,
          hits: 1,
          skillEffect: 'yellow-slash',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 1,
          cooldown: 10,
          knockback: 0,
          range: 200,
          hits: 1,
          skillEffect: 'heavy-blow',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 20,
          knockback: 0,
          range: 500,
          hits: 0,
        },
      },
    },
    'elite-orc': {
      health: 400000,
      move_speed: 80,
      damage: 1000,
      sprite: 'elite-orc',
      name: 'Orc Champion',
      ai_behavior: 'aggressive',
      aggro_range: 400,
      level: 85,
      exp_reward: 400000,
      hitbox_size: 'boss_medium',
      hitbox_offset: { x: 3, y: -3 }, // Offset from centered position
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathGeneric',
        attack1: 'bossAttackPhys',
        attack2: 'bossAttackPhys',
        attack3: 'bossAttackPhys',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 100,
          knockback: 0,
          range: 250,
          hits: 1,
          projectile: null,
          skillEffect: 'yellow-slash',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 1,
          cooldown: 100,
          knockback: 0,
          range: 200,
          hits: 1,
          skillEffect: 'red-slash',
        },
        attack3: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 1,
          knockback: 0,
          range: 150,
          hits: 1,
          skillEffect: 'red-blast',
        },
      },
    },
    'greatsword-skeleton': {
      health: 150000,
      move_speed: 60,
      damage: 600,
      sprite: 'greatsword-skeleton',
      name: 'Skeleton Lord',
      ai_behavior: 'aggressive',
      aggro_range: 400,
      level: 70,
      exp_reward: 150000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -1 }, // Offset from centered position
      audio: {
        on_damaged: 'bossHitBone',
        on_death: 'bossDeathBone',
        attack1: 'bossAttackPhys',
        attack2: 'bossAttackPhys',
        attack3: 'bossAttackMagic',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 100,
          knockback: 0,
          range: 500,
          hits: 1,
          skillEffect: 'red-slash',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 1,
          cooldown: 100,
          knockback: 0,
          range: 400,
          hits: 1,
          skillEffect: 'heavy-blow',
        },
        attack3: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 1,
          knockback: 0,
          range: 500,
          hits: 1,
          skillEffect: 'red-blast',
        },
      },
    },
    orc: {
      health: 10000,
      move_speed: 70,
      damage: 80,
      sprite: 'orc',
      name: 'Orc Warchief',
      ai_behavior: 'aggressive',
      aggro_range: 400,
      level: 20,
      exp_reward: 6000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -1 },
      audio: {
        on_damaged: 'bossHitFlesh',
        on_death: 'bossDeathGeneric',
        attack1: 'bossAttackPhys',
        attack2: 'bossAttackGeneric',
        attack3: 'bossAttackPhys',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 150,
          hits: 1,
          projectile: null,
          skillEffect: 'slash',
        },
        attack2: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 5,
          knockback: 0,
          range: 150,
          hits: 1,
          skillEffect: 'yellow-slash',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 20,
          knockback: 0,
          range: 250,
          hits: 0,
        },
      },
    },
    'armored-orc': {
      health: 25000,
      move_speed: 50,
      damage: 150,
      sprite: 'armored-orc',
      name: 'Orc General',
      ai_behavior: 'aggressive',
      aggro_range: 450,
      level: 30,
      exp_reward: 15000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -1 },
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathGeneric',
        attack1: 'bossAttackPhys',
        attack2: 'bossAttackPhys',
        attack3: 'bossAttackGeneric',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 200,
          hits: 1,
          skillEffect: 'energy-blow',
        },
        attack2: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 300,
          hits: 1,
          skillEffect: 'lightning-shot',
        },
        attack3: {
          attackType: 'area' as const,
          damage: 1,
          cooldown: 10,
          knockback: 0,
          range: 150,
          hits: 1,
          skillEffect: 'holy-blow',
        },
      },
    },
    skeleton: {
      health: 5000,
      move_speed: 65,
      damage: 50,
      sprite: 'skeleton',
      name: 'Skeleton Knight',
      ai_behavior: 'aggressive',
      aggro_range: 350,
      level: 15,
      exp_reward: 3000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -1 },
      audio: {
        on_damaged: 'bossHitBone',
        on_death: 'bossDeathBone',
        attack1: 'bossAttackPhys',
        attack2: 'bossAttackPhys',
        attack3: 'bossAttackMagic',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 300,
          hits: 1,
          skillEffect: 'slash',
        },
        attack2: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 200,
          hits: 1,
          skillEffect: 'slash',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 20,
          knockback: 0,
          range: 250,
          hits: 0,
        },
      },
    },
    'armored-skeleton': {
      health: 40000,
      move_speed: 45,
      damage: 200,
      sprite: 'armored-skeleton',
      name: 'Skeleton Guardian',
      ai_behavior: 'aggressive',
      aggro_range: 300,
      level: 40,
      exp_reward: 30000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 4, y: -1 },
      audio: {
        on_damaged: 'bossHitArmor',
        on_death: 'bossDeathBone',
        attack1: 'bossAttackPhys',
        attack2: 'bossAttackPhys',
        attack3: 'bossAttackPhys',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 300,
          hits: 1,
          skillEffect: 'yellow-slash',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 1,
          cooldown: 10,
          knockback: 0,
          range: 300,
          hits: 5,
          skillEffect: 'lightning-impact',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 20,
          knockback: 0,
          range: 300,
          hits: 0,
        },
      },
    },
    'skeleton-archer': {
      health: 15000,
      move_speed: 75,
      damage: 100,
      sprite: 'skeleton-archer',
      name: 'Skeleton Marksman',
      ai_behavior: 'aggressive',
      aggro_range: 500,
      level: 25,
      exp_reward: 10000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -1 },
      audio: {
        on_damaged: 'bossHitBone',
        on_death: 'bossDeathBone',
        attack1: 'bossAttackArrow',
        attack2: 'bossAttackArrow',
        attack3: 'bossAttackMagic',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 800,
          hits: 1,
          skillEffect: 'arrow-shot',
        },
        attack2: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 10,
          knockback: 0,
          range: 1500,
          hits: 1,
          skillEffect: 'air-blast',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 20,
          knockback: 0,
          range: 600,
          hits: 0,
        },
      },
    },
    slime: {
      health: 2000,
      move_speed: 40,
      damage: 30,
      sprite: 'slime',
      name: 'Giant Slime',
      ai_behavior: 'aggressive',
      aggro_range: 200,
      level: 10,
      exp_reward: 1000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -1 },
      audio: {
        on_damaged: 'bossHitSlime',
        on_death: 'bossDeathSlime',
        attack1: 'bossAttackGeneric',
        attack2: 'bossAttackGeneric',
        attack3: 'bossAttackMagic',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 150,
          hits: 1,
          skillEffect: 'poison-blast',
        },
        attack2: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 20,
          knockback: 0,
          range: 500,
          hits: 0,
        },
        attack3: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 10,
          knockback: 0,
          range: 500,
          hits: 1,
          skillEffect: 'cut-1',
        },
      },
    },
    werewolf: {
      health: 60000,
      move_speed: 120,
      damage: 300,
      sprite: 'werewolf',
      name: 'Alpha Werewolf',
      ai_behavior: 'aggressive',
      aggro_range: 600,
      level: 50,
      exp_reward: 50000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -0.5 }, // Offset from centered position
      audio: {
        on_damaged: 'bossHitFlesh',
        on_death: 'bossDeathGeneric',
        attack1: 'bossAttackGeneric',
        attack2: 'bossAttackGeneric',
        attack3: 'bossAttackMagic',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 3,
          knockback: 0,
          range: 200,
          hits: 1,
          projectile: null,
          skillEffect: 'claw',
        },
        attack2: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 10.0,
          knockback: 10.0,
          range: 500,
          hits: 10,
          projectile: null,
          skillEffect: 'multi-slash',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 20,
          knockback: 0,
          range: 400,
          hits: 0,
        },
      },
    },
    werebear: {
      health: 100000,
      move_speed: 90,
      damage: 400,
      sprite: 'werebear',
      name: 'Ancient Werebear',
      ai_behavior: 'aggressive',
      aggro_range: 500,
      level: 60,
      exp_reward: 80000,
      hitbox_size: 'boss_small',
      hitbox_offset: { x: 0, y: -1 }, // Offset from centered position
      audio: {
        on_damaged: 'bossHitFlesh',
        on_death: 'bossDeathGeneric',
        attack1: 'bossAttackGeneric',
        attack2: 'bossAttackGeneric',
        attack3: 'bossAttackPhys',
      },
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 1,
          knockback: 0,
          range: 300,
          hits: 1,
          projectile: null,
          skillEffect: 'claw',
        },
        attack2: {
          attackType: 'directional' as const,
          damage: 1,
          cooldown: 100,
          knockback: 0,
          range: 450,
          hits: 2,
          skillEffect: 'claw',
        },
        attack3: {
          attackType: 'area' as const,
          damage: 1,
          cooldown: 100,
          knockback: 0,
          range: 250,
          hits: 1,
          skillEffect: 'heavy-blow',
        },
      },
    },
  },
};
