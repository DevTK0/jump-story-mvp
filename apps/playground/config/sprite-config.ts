import type { SpriteConfig, SpriteDefinition } from '@/core';

// Constants for shared dimensions
const SPRITE_SIZE = 100;
const EMOTE_SIZE = 187;

// Common animation patterns
const EMOTE_ANIMATION = {
  play: { start: 0, end: 6, frameRate: 12 }
} as const;

const EMOTE_ANIMATION_SLOW = {
  play: { start: 0, end: 6, frameRate: 8 }
} as const;

/**
 * Helper function to create emote definitions
 */
function createEmoteDefinition(name: string, frameRate = 12): SpriteDefinition {
  return {
    path: `assets/spritesheet/emotes/${name}.png`,
    frameWidth: EMOTE_SIZE,
    frameHeight: EMOTE_SIZE,
    animations: frameRate === 12 ? EMOTE_ANIMATION : EMOTE_ANIMATION_SLOW
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
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 45, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 15 }
    }
  },
  knight: {
    path: 'assets/spritesheet/jobs/Knight.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 44, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 62, frameRate: 15 }
    }
  },
  wizard: {
    path: 'assets/spritesheet/jobs/Wizard.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 25, frameRate: 20 },
      attack2: { start: 27, end: 35, frameRate: 20 },
      damaged: { start: 36, end: 40, frameRate: 15 },
      death: { start: 45, end: 52, frameRate: 15 }
    }
  },
  archer: {
    path: 'assets/spritesheet/jobs/Archer.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 44, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 15 }
    }
  },
  'armored-axeman': {
    path: 'assets/spritesheet/jobs/Armored%20Axeman.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 44, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 15 }
    }
  },
  'knight-templar': {
    path: 'assets/spritesheet/jobs/Knight%20Templar.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 44, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 15 }
    }
  },
  lancer: {
    path: 'assets/spritesheet/jobs/Lancer.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 44, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 15 }
    }
  },
  priest: {
    path: 'assets/spritesheet/jobs/Priest.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 15 }
    }
  },
  swordsman: {
    path: 'assets/spritesheet/jobs/Swordsman.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 12 },
      attack1: { start: 18, end: 23, frameRate: 20 },
      attack2: { start: 27, end: 32, frameRate: 20 },
      attack3: { start: 36, end: 44, frameRate: 20 },
      damaged: { start: 45, end: 49, frameRate: 15 },
      death: { start: 54, end: 57, frameRate: 15 }
    }
  }
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
      death: { start: 40, end: 43, frameRate: 12 }
    }
  },
  skeleton: {
    path: 'assets/spritesheet/enemies/Skeleton.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 5, frameRate: 8 },
      walk: { start: 9, end: 16, frameRate: 10 },
      attack1: { start: 18, end: 22, frameRate: 20 },
      attack2: { start: 27, end: 31, frameRate: 20 },
      damaged: { start: 36, end: 40, frameRate: 15 },
      death: { start: 45, end: 48, frameRate: 12 }
    }
  },
  slime: {
    path: 'assets/spritesheet/enemies/Slime.png',
    frameWidth: SPRITE_SIZE,
    frameHeight: SPRITE_SIZE,
    animations: {
      idle: { start: 0, end: 3, frameRate: 6 },
      walk: { start: 4, end: 7, frameRate: 8 },
      attack1: { start: 8, end: 11, frameRate: 15 },
      attack2: { start: 12, end: 15, frameRate: 15 },
      damaged: { start: 16, end: 18, frameRate: 12 },
      death: { start: 19, end: 22, frameRate: 10 }
    }
  }
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
  typing: createEmoteDefinition('typing', 8) // Slower frame rate
} as const;

// Complete sprite configuration
const spriteConfig: SpriteConfig = {
  sprites: {
    jobs: jobSprites,
    enemies: enemySprites,
    emotes: emoteSprites
  }
} as const;

// Export both the full config and individual parts for flexibility
export default spriteConfig;

// Type exports for better type inference
export type JobSpriteKey = keyof typeof jobSprites;
export type EnemySpriteKey = keyof typeof enemySprites;
export type EmoteSpriteKey = keyof typeof emoteSprites;