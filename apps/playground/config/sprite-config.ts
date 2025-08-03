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
      attack2: { start: 36, end: 44, frameRate: 20 },
      attack3: { start: 27, end: 32, frameRate: 20 },
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
      attack1: { start: 45, end: 50, frameRate: 15 },
      attack2: { start: 90, end: 95, frameRate: 15 },
      attack3: { start: 45, end: 50, frameRate: 15 },
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
      attack2: { start: 60, end: 71, frameRate: 20 },
      attack3: { start: 45, end: 59, frameRate: 20 },
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
      walk: { start: 8, end: 16, frameRate: 10 },
      attack1: { start: 16, end: 21, frameRate: 15 },
      attack2: { start: 24, end: 29, frameRate: 15 },
      attack3: { start: 0, end: 5, frameRate: 15 },
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
      attack3: { start: 36, end: 44, frameRate: 15 },
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
      attack1: { start: 22, end: 28, frameRate: 15 },
      attack2: { start: 33, end: 43, frameRate: 15 },
      attack3: { start: 44, end: 51, frameRate: 15 },
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
  'orc-rider-2': {
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
      attack3: { start: 32, end: 35, frameRate: 15 },
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
      attack1: { start: 18, end: 25, frameRate: 15 },
      attack2: { start: 27, end: 35, frameRate: 15 },
      attack3: { start: 0, end: 5, frameRate: 15 },
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
      attack3: { start: 0, end: 5, frameRate: 15 },
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
      attack1: { start: 24, end: 32, frameRate: 15 },
      attack2: { start: 36, end: 47, frameRate: 15 },
      attack3: { start: 48, end: 55, frameRate: 15 },
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
      attack1: { start: 24, end: 29, frameRate: 15 },
      attack2: { start: 0, end: 5, frameRate: 15 },
      attack3: { start: 36, end: 47, frameRate: 15 },
      damaged: { start: 48, end: 51, frameRate: 12 },
      death: { start: 60, end: 63, frameRate: 10 },
    },
  },
  'super-slime': {
    path: 'assets/spritesheet/enemies/Slime.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 6 },
      walk: { start: 12, end: 17, frameRate: 8 },
      attack1: { start: 24, end: 29, frameRate: 15 },
      attack2: { start: 0, end: 5, frameRate: 15 },
      attack3: { start: 36, end: 47, frameRate: 15 },
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
      attack1: { start: 26, end: 34, frameRate: 15 },
      attack2: { start: 39, end: 51, frameRate: 15 },
      attack3: { start: 0, end: 5, frameRate: 15 },
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
      attack1: { start: 26, end: 34, frameRate: 15 },
      attack2: { start: 39, end: 51, frameRate: 15 },
      attack3: { start: 52, end: 60, frameRate: 15 },
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
    scale: 3, // Big scale for fireballs
    animations: {
      play: { start: 0, end: 6, frameRate: 20 },  // Static sprite
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

  'red-slash': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 240, end: 248, frameRate: 20 }, // Static sprite for now
    },
  },

  'lightning-shot': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 190, end: 198, frameRate: 20 }, // Static sprite for now
    },
  },

  'gae-bolg': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 200, end: 205, frameRate: 20 }, // Static sprite for now
    },
  },

  'heavy-blow': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 210, end: 215, frameRate: 20 }, // Static sprite for now
    },
  },

  'fire-explosion': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 210, end: 215, frameRate: 20 }, // Static sprite for now
    },
  },

  'mana-eruption': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 220, end: 226, frameRate: 20 }, // Static sprite for now
    },
  },

  'sand-shot': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 230, end: 233, frameRate: 20 }, // Static sprite for now
    },
  },

  'holy-blow': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 250, end: 256, frameRate: 20 }, // Static sprite for now
    },
  },

  'yellow-slash': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 260, end: 265, frameRate: 20 }, // Static sprite for now
    },
  },

  'poison-blast': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 270, end: 276, frameRate: 20 }, // Static sprite for now
    },
  },

  glowflies: {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 280, end: 287, frameRate: 20 }, // Static sprite for now
    },
  },

  'energy-slash': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 150, end: 157, frameRate: 20 }, // Static sprite for now
    },
  },

  'red-blast': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 140, end: 145, frameRate: 20 }, // Static sprite for now
    },
  },

  'air-blast': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 130, end: 134, frameRate: 20 }, // Static sprite for now
    },
  },

  'arrow-shot': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 120, end: 124, frameRate: 20 }, // Static sprite for now
    },
  },

  'energy-uppercut': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 110, end: 116, frameRate: 20 }, // Static sprite for now
    },
  },

  'purple-slash': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 90, end: 94, frameRate: 20 }, // Static sprite for now
    },
  },

  'cut-2': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 80, end: 83, frameRate: 20 }, // Static sprite for now
    },
  },

  'bullet-shot': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 70, end: 74, frameRate: 20 }, // Static sprite for now
    },
  },

  'energy-impact': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 60, end: 63, frameRate: 20 }, // Static sprite for now
    },
  },

  'lightning-impact': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 50, end: 54, frameRate: 20 }, // Static sprite for now
    },
  },

  'candle-slash': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 40, end: 45, frameRate: 20 }, // Static sprite for now
    },
  },

  'flame-shot': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 30, end: 36, frameRate: 20 }, // Static sprite for now
    },
  },

  'energy-blow': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 20, end: 24, frameRate: 20 }, // Static sprite for now
    },
  },

  slash: {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 10, end: 13, frameRate: 20 }, // Static sprite for now
    },
  },

  'slash-impact': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 0, end: 4, frameRate: 20 }, // Static sprite for now
    },
  },

  // enemy
  claw: {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 180, end: 182, frameRate: 20 }, // Static sprite for now
    },
  },

  'multi-slash': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 170, end: 175, frameRate: 20 }, // Static sprite for now
    },
  },

  'claw-slash': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 160, end: 163, frameRate: 20 }, // Static sprite for now
    },
  },

  'cut-1': {
    path: 'assets/spritesheet/effects/Combat-Sheet.png',
    frameWidth: 64,
    frameHeight: 64,
    scale: 2, // Default scale for skill effects
    animations: {
      play: { start: 100, end: 104, frameRate: 20 }, // Static sprite for now
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
  holy1: {
    path: 'assets/spritesheet/icons/holy1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  holy2: {
    path: 'assets/spritesheet/icons/holy2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  arrow1: {
    path: 'assets/spritesheet/icons/arrow1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  arrow2: {
    path: 'assets/spritesheet/icons/arrow2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  arrow3: {
    path: 'assets/spritesheet/icons/arrow3.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  magic1: {
    path: 'assets/spritesheet/icons/magic1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  magic2: {
    path: 'assets/spritesheet/icons/magic2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  magic3: {
    path: 'assets/spritesheet/icons/magic3.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  sword1: {
    path: 'assets/spritesheet/icons/sword1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  sword2: {
    path: 'assets/spritesheet/icons/sword2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  sword3: {
    path: 'assets/spritesheet/icons/sword3.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  fire_sword: {
    path: 'assets/spritesheet/icons/fire_sword.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  slash1: {
    path: 'assets/spritesheet/icons/slash1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  slash2: {
    path: 'assets/spritesheet/icons/slash2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  slash3: {
    path: 'assets/spritesheet/icons/slash3.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  charge1: {
    path: 'assets/spritesheet/icons/charge1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  charge2: {
    path: 'assets/spritesheet/icons/charge2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  fire1: {
    path: 'assets/spritesheet/icons/fire1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  fire2: {
    path: 'assets/spritesheet/icons/fire2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  ice1: {
    path: 'assets/spritesheet/icons/ice1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  lightning1: {
    path: 'assets/spritesheet/icons/lightning1.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  lightning2: {
    path: 'assets/spritesheet/icons/lightning2.png',
    frameWidth: 16,
    frameHeight: 16,
    scale: 2,
    animations: {
      play: { start: 0, end: 0, frameRate: 1 }, // Static icon
    },
  },
  shield1: {
    path: 'assets/spritesheet/icons/shield1.png',
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
