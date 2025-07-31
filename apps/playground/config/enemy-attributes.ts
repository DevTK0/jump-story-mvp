export interface EnemyAttribute {
  health: number;
  move_speed: number;
  damage: number;
  sprite: string;
  name: string;
  ai_behavior: 'patrol' | 'aggressive';
  attack_range: number;
  aggro_range: number;
  level: number;
  exp_reward: number;
  boss_trigger?: {
    boss_to_spawn: string;
    required_kills: number;
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
      health: 100,
      move_speed: 50,
      damage: 10,
      sprite: 'orc',
      name: 'Orc',
      ai_behavior: 'patrol',
      attack_range: 50,
      aggro_range: 150,
      level: 1,
      exp_reward: 25,
      boss_trigger: {
        boss_to_spawn: 'orc-rider',
        required_kills: 1,
      },
    },
    'armored-orc': {
      health: 150,
      move_speed: 40,
      damage: 15,
      sprite: 'armored-orc',
      name: 'Armored Orc',
      ai_behavior: 'aggressive',
      attack_range: 50,
      aggro_range: 200,
      level: 3,
      exp_reward: 50,
    },
    'elite-orc': {
      health: 250,
      move_speed: 60,
      damage: 25,
      sprite: 'elite-orc',
      name: 'Elite Orc',
      ai_behavior: 'aggressive',
      attack_range: 60,
      aggro_range: 250,
      level: 5,
      exp_reward: 100,
      boss_trigger: {
        boss_to_spawn: 'elite-orc',
        required_kills: 1000000,
      },
    },
    'orc-rider': {
      health: 200,
      move_speed: 80,
      damage: 20,
      sprite: 'orc-rider',
      name: 'Orc Rider',
      ai_behavior: 'patrol',
      attack_range: 70,
      aggro_range: 300,
      level: 4,
      exp_reward: 75,
    },
    skeleton: {
      health: 80,
      move_speed: 45,
      damage: 8,
      sprite: 'skeleton',
      name: 'Skeleton',
      ai_behavior: 'patrol',
      attack_range: 45,
      aggro_range: 150,
      level: 1,
      exp_reward: 20,
    },
    'armored-skeleton': {
      health: 120,
      move_speed: 35,
      damage: 12,
      sprite: 'armored-skeleton',
      name: 'Armored Skeleton',
      ai_behavior: 'aggressive',
      attack_range: 50,
      aggro_range: 180,
      level: 2,
      exp_reward: 40,
    },
    'skeleton-archer': {
      health: 60,
      move_speed: 50,
      damage: 15,
      sprite: 'skeleton-archer',
      name: 'Skeleton Archer',
      ai_behavior: 'patrol',
      attack_range: 200,
      aggro_range: 250,
      level: 2,
      exp_reward: 35,
    },
    'greatsword-skeleton': {
      health: 180,
      move_speed: 30,
      damage: 30,
      sprite: 'greatsword-skeleton',
      name: 'Greatsword Skeleton',
      ai_behavior: 'aggressive',
      attack_range: 80,
      aggro_range: 200,
      level: 4,
      exp_reward: 80,
      boss_trigger: {
        boss_to_spawn: 'greatsword-skeleton',
        required_kills: 1000000,
      },
    },
    slime: {
      health: 40,
      move_speed: 30,
      damage: 5,
      sprite: 'slime',
      name: 'Slime',
      ai_behavior: 'patrol',
      attack_range: 30,
      aggro_range: 100,
      level: 1,
      exp_reward: 10,
    },
    werewolf: {
      health: 300,
      move_speed: 70,
      damage: 35,
      sprite: 'werewolf',
      name: 'Werewolf',
      ai_behavior: 'aggressive',
      attack_range: 60,
      aggro_range: 300,
      level: 6,
      exp_reward: 150,
      boss_trigger: {
        boss_to_spawn: 'werewolf',
        required_kills: 1000000,
      },
    },
    werebear: {
      health: 400,
      move_speed: 50,
      damage: 40,
      sprite: 'werebear',
      name: 'Werebear',
      ai_behavior: 'aggressive',
      attack_range: 70,
      aggro_range: 250,
      level: 7,
      exp_reward: 200,
      boss_trigger: {
        boss_to_spawn: 'werebear',
        required_kills: 1000000,
      },
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
}

export interface BossAttribute {
  health: number;
  move_speed: number;
  damage: number;
  sprite: string;
  name: string;
  ai_behavior: 'patrol' | 'aggressive';
  attack_range: number;
  aggro_range: number;
  level: number;
  exp_reward: number;
  attacks?: {
    attack1?: BossAttack;
    attack2?: BossAttack;
    attack3?: BossAttack;
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
      health: 2000,
      move_speed: 100,
      damage: 50,
      sprite: 'orc-rider',
      name: 'Orc Warlord',
      ai_behavior: 'aggressive',
      attack_range: 100,
      aggro_range: 500,
      level: 10,
      exp_reward: 1000,
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 15,
          cooldown: 1.5,
          knockback: 0,
          range: 200,
          hits: 1,
          projectile: null,
          skillEffect: 'freeze',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 15,
          cooldown: 1,
          knockback: 0,
          range: 200,
          hits: 1,
          skillEffect: 'freeze',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 0.6,
          knockback: 300,
          range: 500,
          hits: 1,
          skillEffect: 'freeze',
        },
      },
    },
    'elite-orc': {
      health: 2500,
      move_speed: 80,
      damage: 60,
      sprite: 'elite-orc',
      name: 'Orc Champion',
      ai_behavior: 'aggressive',
      attack_range: 80,
      aggro_range: 400,
      level: 12,
      exp_reward: 1500,
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 20,
          cooldown: 0.8,
          knockback: 400,
          range: 250,
          hits: 1,
          projectile: null,
          skillEffect: 'stun',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 25,
          cooldown: 1.2,
          knockback: 500,
          range: 300,
          hits: 1,
          skillEffect: 'earthquake',
        },
        attack3: {
          attackType: 'directional' as const,
          damage: 30,
          cooldown: 2.0,
          knockback: 600,
          range: 350,
          hits: 3,
          projectile: 'spear',
          skillEffect: 'bleed',
        },
      },
    },
    'greatsword-skeleton': {
      health: 3000,
      move_speed: 60,
      damage: 70,
      sprite: 'greatsword-skeleton',
      name: 'Skeleton Lord',
      ai_behavior: 'aggressive',
      attack_range: 120,
      aggro_range: 400,
      level: 15,
      exp_reward: 2000,
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 35,
          cooldown: 1.0,
          knockback: 500,
          range: 300,
          hits: 1,
          projectile: null,
          skillEffect: 'slash',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 40,
          cooldown: 1.5,
          knockback: 600,
          range: 400,
          hits: 1,
          skillEffect: 'whirlwind',
        },
        attack3: {
          attackType: 'summon' as const,
          damage: 0,
          cooldown: 3.0,
          knockback: 0,
          range: 500,
          hits: 1,
          skillEffect: 'summon_skeleton',
        },
      },
    },
    werewolf: {
      health: 4000,
      move_speed: 120,
      damage: 80,
      sprite: 'werewolf',
      name: 'Alpha Werewolf',
      ai_behavior: 'aggressive',
      attack_range: 100,
      aggro_range: 600,
      level: 18,
      exp_reward: 3000,
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 40,
          cooldown: 0.6,
          knockback: 400,
          range: 250,
          hits: 2,
          projectile: null,
          skillEffect: 'claw',
        },
        attack2: {
          attackType: 'directional' as const,
          damage: 50,
          cooldown: 1.0,
          knockback: 600,
          range: 350,
          hits: 1,
          projectile: null,
          skillEffect: 'howl',
        },
        attack3: {
          attackType: 'area' as const,
          damage: 60,
          cooldown: 2.0,
          knockback: 800,
          range: 400,
          hits: 1,
          skillEffect: 'frenzy',
        },
      },
    },
    werebear: {
      health: 5000,
      move_speed: 90,
      damage: 100,
      sprite: 'werebear',
      name: 'Ancient Werebear',
      ai_behavior: 'aggressive',
      attack_range: 120,
      aggro_range: 500,
      level: 20,
      exp_reward: 5000,
      attacks: {
        attack1: {
          attackType: 'directional' as const,
          damage: 50,
          cooldown: 0.8,
          knockback: 500,
          range: 300,
          hits: 1,
          projectile: null,
          skillEffect: 'maul',
        },
        attack2: {
          attackType: 'area' as const,
          damage: 70,
          cooldown: 1.5,
          knockback: 700,
          range: 450,
          hits: 1,
          skillEffect: 'ground_slam',
        },
        attack3: {
          attackType: 'directional' as const,
          damage: 100,
          cooldown: 3.0,
          knockback: 1000,
          range: 500,
          hits: 1,
          projectile: 'boulder',
          skillEffect: 'stun',
        },
      },
    },
  },
};
