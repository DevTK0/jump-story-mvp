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
        required_kills: 20,
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
    },
  },
};
