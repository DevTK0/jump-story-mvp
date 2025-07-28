export interface EnemyAttribute {
  health: number;
  move_speed: number;
  damage: number;
  sprite: string;
  ai_behavior: 'patrol' | 'aggressive';
  attack_range: number;
  aggro_range: number;
  level: number;
  exp_reward: number;
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
      ai_behavior: 'patrol',
      attack_range: 50,
      aggro_range: 150,
      level: 1,
      exp_reward: 25,
    },
    'armored-orc': {
      health: 150,
      move_speed: 40,
      damage: 15,
      sprite: 'armored-orc',
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
      ai_behavior: 'aggressive',
      attack_range: 60,
      aggro_range: 250,
      level: 5,
      exp_reward: 100,
    },
    'orc-rider': {
      health: 200,
      move_speed: 80,
      damage: 20,
      sprite: 'orc-rider',
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
      ai_behavior: 'aggressive',
      attack_range: 80,
      aggro_range: 200,
      level: 4,
      exp_reward: 80,
    },
  },
};
