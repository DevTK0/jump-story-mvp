import type { AudioConfig, AudioDefinition } from '@/core';

/**
 * Skill effect audio definitions
 */
export const skillEffectAudio: Record<string, AudioDefinition> = {
  skill1: {
    path: 'assets/audio/skills/skill1.mp3',
    volume: 0.5,
    loop: false,
  },
};

/**
 * UI sound effects
 */
export const uiAudio: Record<string, AudioDefinition> = {};

/**
 * Player event sound effects
 */
export const playerAudio: Record<string, AudioDefinition> = {
  death: { path: 'assets/audio/skills/skill1.mp3', volume: 0.4, loop: false },
  respawn: { path: 'assets/audio/skills/skill1.mp3', volume: 0.5, loop: false },
  classChange: { path: 'assets/audio/skills/skill1.mp3', volume: 0.6, loop: false },
  jump: { path: 'assets/audio/skills/skill1.mp3', volume: 0.3, loop: false },
  teleportUnlock: { path: 'assets/audio/skills/skill1.mp3', volume: 0.7, loop: false },
};

/**
 * Background music
 */
export const musicAudio: Record<string, AudioDefinition> = {
  backgroundMusic: { path: 'assets/audio/music/adorable_adventures.mp3', volume: 0.3, loop: true },
  battleMusic: { path: 'assets/audio/music/battle_of_gods.mp3', volume: 0.4, loop: true },
};

/**
 * Enemy sound effects
 */
export const enemyAudio: Record<string, AudioDefinition> = {
  enemyHit: { path: 'assets/audio/skills/enemy-hit.mp3', volume: 0.3, loop: false },
  enemyDeath: { path: 'assets/audio/skills/enemy-death.mp3', volume: 0.4, loop: false },
  bossHit: { path: 'assets/audio/skills/boss-hit.mp3', volume: 0.35, loop: false },
  bossDeath: { path: 'assets/audio/skills/boss-death.mp3', volume: 0.5, loop: false },
  bossAttack1: { path: 'assets/audio/skills/boss-attack.mp3', volume: 0.5, loop: false },
  bossAttack2: { path: 'assets/audio/skills/boss-attack.mp3', volume: 0.5, loop: false },
  bossAttack3: { path: 'assets/audio/skills/boss-attack.mp3', volume: 0.5, loop: false },
};

/**
 * Complete audio configuration
 */
const audioConfig: AudioConfig = {
  audio: {
    skills: skillEffectAudio,
    ui: uiAudio,
    player: playerAudio,
    music: musicAudio,
    enemies: enemyAudio,
  },
} as const;

// Export both the full config and individual parts for flexibility
export default audioConfig;

// Type exports for better type inference
export type SkillEffectAudioKey = keyof typeof skillEffectAudio;
export type UIAudioKey = keyof typeof uiAudio;
export type PlayerAudioKey = keyof typeof playerAudio;
export type MusicAudioKey = keyof typeof musicAudio;