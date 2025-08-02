import type { SpriteConfig, SpriteDefinition } from '@/core';

// Constants for shared dimensions
const SPRITE_SIZE = 100;
const EMOTE_SIZE = 187;

// Common animation patterns
const EMOTE_ANIMATION = {
  play: { start: 0, end: 6, frameRate: 12 },
} as const;

const EMOTE_ANIMATION_SLOW = {
  play: { start: 0, end: 6, frameRate: 8 },
} as const;

/**
 * Helper function to create emote definitions
 */
function createEmoteDefinition(name: string, frameRate = 12): SpriteDefinition {
  return {
    path: `assets/spritesheet/emotes/${name}.png`,
    frameWidth: EMOTE_SIZE,
    frameHeight: EMOTE_SIZE,
    animations: frameRate === 12 ? EMOTE_ANIMATION : EMOTE_ANIMATION_SLOW,
  };
}

// Job sprites
export const jobSprites = {
  soldier: {
    path: 'assets/spritesheet/jobs/Soldier.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 15 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 44, frameRate: 20 },
      damaged: { start: 45, end: 48, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 8 },
    },
  },
  knight: {
    path: 'assets/spritesheet/jobs/Knight.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 11, end: 18, frameRate: 12 },
      attack1: { start: 22, end: 28, frameRate: 20 },
      attack2: { start: 33, end: 42, frameRate: 20 },
      attack3: { start: 44, end: 54, frameRate: 20 },
      damaged: { start: 66, end: 69, frameRate: 15 },
      death: { start: 77, end: 80, frameRate: 8 },
    },
  },
  wizard: {
    path: 'assets/spritesheet/jobs/Wizard.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 15, end: 22, frameRate: 12 },
      attack1: { start: 30, end: 45, frameRate: 15 },
      attack2: { start: 75, end: 86, frameRate: 15 },
      attack3: { start: 75, end: 86, frameRate: 15 }, // Using attack2 frames as fallback
      damaged: { start: 120, end: 123, frameRate: 15 },
      death: { start: 135, end: 138, frameRate: 8 },
    },
  },
  archer: {
    path: 'assets/spritesheet/jobs/Archer.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 12, end: 19, frameRate: 12 },
      attack1: { start: 24, end: 32, frameRate: 15 },
      attack2: { start: 24, end: 32, frameRate: 15 },
      attack3: { start: 36, end: 47, frameRate: 15 },
      damaged: { start: 48, end: 51, frameRate: 15 },
      death: { start: 60, end: 63, frameRate: 8 },
    },
  },
  'armored-axeman': {
    path: 'assets/spritesheet/jobs/Armored%20Axeman.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 12, end: 19, frameRate: 12 },
      attack1: { start: 24, end: 32, frameRate: 15 },
      attack2: { start: 36, end: 44, frameRate: 20 },
      attack3: { start: 48, end: 59, frameRate: 20 },
      damaged: { start: 60, end: 63, frameRate: 15 },
      death: { start: 72, end: 75, frameRate: 8 },
    },
  },
  'knight-templar': {
    path: 'assets/spritesheet/jobs/Knight%20Templar.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 11, end: 18, frameRate: 12 },
      attack1: { start: 33, end: 39, frameRate: 15 },
      attack2: { start: 55, end: 69, frameRate: 20 },
      attack3: { start: 22, end: 29, frameRate: 20 },
      damaged: { start: 77, end: 80, frameRate: 15 },
      death: { start: 88, end: 91, frameRate: 8 },
    },
  },
  lancer: {
    path: 'assets/spritesheet/jobs/Lancer.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 18, end: 25, frameRate: 12 },
      attack1: { start: 27, end: 32, frameRate: 15 },
      attack2: { start: 36, end: 44, frameRate: 20, repeat: -1 },
      attack3: { start: 45, end: 52, frameRate: 20, repeat: -1 },
      damaged: { start: 54, end: 57, frameRate: 15 },
      death: { start: 63, end: 66, frameRate: 8 },
    },
  },
  priest: {
    path: 'assets/spritesheet/jobs/Priest.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 27, frameRate: 15 },
      attack2: { start: 45, end: 50, frameRate: 20 },
      attack3: { start: 54, end: 59, frameRate: 20 },
      damaged: { start: 72, end: 75, frameRate: 15 },
      death: { start: 81, end: 84, frameRate: 8 },
    },
  },
  swordsman: {
    path: 'assets/spritesheet/jobs/Swordsman.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 15, end: 22, frameRate: 12 },
      attack1: { start: 30, end: 36, frameRate: 15 },
      attack2: { start: 45, end: 59, frameRate: 20 },
      attack3: { start: 60, end: 71, frameRate: 20 },
      damaged: { start: 75, end: 79, frameRate: 15 },
      death: { start: 90, end: 93, frameRate: 8 },
    },
  },
} as const;

// Enemy sprites
export const enemySprites = {
  orc: {
    path: 'assets/spritesheet/enemies/Orc.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 10 },
      damaged: { start: 32, end: 35, frameRate: 15 },
      death: { start: 40, end: 43, frameRate: 12 },
    },
  },
  'armored-orc': {
    path: 'assets/spritesheet/enemies/Armored%20Orc.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 10 },
      attack1: { start: 18, end: 23, frameRate: 15 },
      attack2: { start: 27, end: 32, frameRate: 15 },
      damaged: { start: 54, end: 57, frameRate: 15 },
      death: { start: 63, end: 66, frameRate: 12 },
    },
  },
  'elite-orc': {
    path: 'assets/spritesheet/enemies/Elite%20Orc.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 11, end: 18, frameRate: 10 },
      attack1: { start: 22, end: 23, frameRate: 15 },
      attack2: { start: 33, end: 32, frameRate: 15 },
      damaged: { start: 55, end: 58, frameRate: 15 },
      death: { start: 66, end: 69, frameRate: 12 },
    },
  },
  'orc-rider': {
    path: 'assets/spritesheet/enemies/Orc%20rider.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 11, end: 18, frameRate: 10 },
      attack1: { start: 22, end: 29, frameRate: 15 },
      attack2: { start: 44, end: 54, frameRate: 15 },
      attack3: { start: 55, end: 57, frameRate: 15 },
      damaged: { start: 66, end: 69, frameRate: 15 },
      death: { start: 77, end: 80, frameRate: 12 },
    },
  },
  skeleton: {
    path: 'assets/spritesheet/enemies/Skeleton.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 8, end: 15, frameRate: 10 },
      attack1: { start: 16, end: 21, frameRate: 15 },
      attack2: { start: 24, end: 30, frameRate: 15 },
      damaged: { start: 40, end: 43, frameRate: 15 },
      death: { start: 48, end: 51, frameRate: 12 },
    },
  },
  'armored-skeleton': {
    path: 'assets/spritesheet/enemies/Armored%20Skeleton.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 10 },
      attack1: { start: 18, end: 23, frameRate: 15 },
      attack2: { start: 27, end: 32, frameRate: 15 },
      damaged: { start: 36, end: 39, frameRate: 15 },
      death: { start: 45, end: 48, frameRate: 12 },
    },
  },
  'skeleton-archer': {
    path: 'assets/spritesheet/enemies/Skeleton%20Archer.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 10 },
      attack1: { start: 18, end: 26, frameRate: 15 },
      attack2: { start: 18, end: 26, frameRate: 15 },
      damaged: { start: 27, end: 30, frameRate: 15 },
      death: { start: 36, end: 39, frameRate: 12 },
    },
  },
  'greatsword-skeleton': {
    path: 'assets/spritesheet/enemies/Greatsword%20Skeleton.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 12, end: 20, frameRate: 10 },
      attack1: { start: 24, end: 25, frameRate: 15 },
      attack2: { start: 36, end: 34, frameRate: 15 },
      damaged: { start: 60, end: 63, frameRate: 15 },
      death: { start: 72, end: 75, frameRate: 12 },
    },
  },
  slime: {
    path: 'assets/spritesheet/enemies/Slime.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 6 },
      walk: { start: 12, end: 17, frameRate: 8 },
      attack1: { start: 24, end: 31, frameRate: 15 },
      attack2: { start: 36, end: 45, frameRate: 15 },
      damaged: { start: 48, end: 51, frameRate: 12 },
      death: { start: 60, end: 63, frameRate: 10 },
    },
  },
  werewolf: {
    path: 'assets/spritesheet/enemies/Werewolf.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 13, end: 20, frameRate: 10 },
      attack1: { start: 26, end: 33, frameRate: 15 },
      attack2: { start: 39, end: 42, frameRate: 15 },
      damaged: { start: 52, end: 55, frameRate: 15 },
      death: { start: 65, end: 68, frameRate: 12 },
    },
  },
  werebear: {
    path: 'assets/spritesheet/enemies/Werebear.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 13, end: 20, frameRate: 10 },
      attack1: { start: 26, end: 23, frameRate: 15 },
      attack2: { start: 39, end: 32, frameRate: 15 },
      damaged: { start: 65, end: 68, frameRate: 15 },
      death: { start: 78, end: 81, frameRate: 12 },
    },
  },
} as const;

// Emote sprites - using helper function to reduce repetition
export const emoteSprites = {
  exclamation: createEmoteDefinition('!!'),
  question_exclamation: createEmoteDefinition('question_exclamation'),
  question: createEmoteDefinition('question'),
  blush: createEmoteDefinition('blush'),
  heart: createEmoteDefinition('heart'),
  sad: createEmoteDefinition('sad'),
  sparkle: createEmoteDefinition('sparkle'),
  sweat: createEmoteDefinition('sweat'),
  teardrop: createEmoteDefinition('teardrop'),
  whistle: createEmoteDefinition('whistle'),
  wow: createEmoteDefinition('wow'),
  wtf: createEmoteDefinition('wtf'),
  zzz: createEmoteDefinition('zzz'),
  typing: createEmoteDefinition('typing', 8), // Slower frame rate
} as const;

// Object sprites (world objects like teleport stones)
export const objectSprites: Record<string, SpriteDefinition> = {
  'teleport-stone': {
    path: 'assets/spritesheet/npcs/teleport_stone.png',
    frameWidth: 100,
    frameHeight: 100,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Default animation
      locked: { start: 0, end: 0, frameRate: 1 },
      unlocked: { start: 1, end: 1, frameRate: 1 },
    },
  },
};

// Projectile sprites
export const projectileSprites: Record<string, SpriteDefinition> = {
  arrow: {
    path: 'assets/spritesheet/projectiles/Arrow01(32x32).png',
    frameWidth: 32,
    frameHeight: 32,
    scale: 2, // Scale arrows to 64x64
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static sprite
    },
  },
  'power-arrow': {
    path: 'assets/spritesheet/projectiles/Arrow02(32x32).png',
    frameWidth: 32,
    frameHeight: 32,
    scale: 2, // Scale arrows to 64x64
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static sprite
    },
  },
  'piercing-arrow': {
    path: 'assets/spritesheet/projectiles/Arrow03(32x32).png',
    frameWidth: 32,
    frameHeight: 32,
    scale: 2, // Scale arrows to 64x64
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static sprite
    },
  },
  fireball: {
    path: 'assets/spritesheet/projectiles/fireball.png',
    frameWidth: 100,
    frameHeight: 100,
    scale: 1.5, // Slightly smaller scale for fireballs
    animations: {
      play: { start: 0, end: 6, frameRate: 20 }, // Static sprite
    },
  },
};

// Skill effect sprites
export const skillEffectSprites: Record<string, SpriteDefinition> = {
  freeze: {
    path: 'assets/spritesheet/effects/freeze.png',
    frameWidth: 100,
    frameHeight: 100,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 0, end: 9, frameRate: 20 }, // Static sprite for now
    },
  },
  heal: {
    path: 'assets/spritesheet/effects/heal.png',
    frameWidth: 100,
    frameHeight: 100,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 0, end: 3, frameRate: 20 }, // Static sprite for now
    },
  },
  holy: {
    path: 'assets/spritesheet/effects/holy.png',
    frameWidth: 100,
    frameHeight: 100,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 0, end: 4, frameRate: 20 }, // Static sprite for now
    },
  },
};

// Respawn effect sprites
export const respawnEffectSprites: Record<string, SpriteDefinition> = {
  respawn: {
    path: 'assets/spritesheet/effects/Haste.png',
    frameWidth: 32,
    frameHeight: 32,
    scale: 3, // Scale up to 96x96 for visibility
    animations: {
      play: { start: 23, end: 0, frameRate: 20 }, // 24 frames total (6x4 grid)
    },
  },
};

// Icon sprites for abilities
export const iconSprites: Record<string, SpriteDefinition> = {
  heal1: {
    path: 'assets/spritesheet/icons/heal1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  heal2: {
    path: 'assets/spritesheet/icons/heal2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  heal3: {
    path: 'assets/spritesheet/icons/heal3.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
};

// Complete sprite configuration
const spriteConfig: SpriteConfig = {
  sprites: {
    jobs: jobSprites,
    enemies: enemySprites,
    emotes: emoteSprites,
    objects: objectSprites,
    projectiles: projectileSprites,
    effects: skillEffectSprites,
    respawnEffects: respawnEffectSprites,
    icons: iconSprites,
  },
} as const;

// Export both the full config and individual parts for flexibility
export default spriteConfig;

// Type exports for better type inference
export type JobSpriteKey = keyof typeof jobSprites;
export type EnemySpriteKey = keyof typeof enemySprites;
export type EmoteSpriteKey = keyof typeof emoteSprites;
export type ProjectileSpriteKey = keyof typeof projectileSprites;
export type SkillEffectSpriteKey = keyof typeof skillEffectSprites;
export type IconSpriteKey = keyof typeof iconSprites;
