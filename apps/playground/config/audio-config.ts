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
  // Add more skill sounds here as needed
  // skill2: { path: 'assets/audio/skills/skill2.mp3', volume: 0.5 },
  // skill3: { path: 'assets/audio/skills/skill3.mp3', volume: 0.5 },
};

/**
 * UI sound effects
 */
export const uiAudio: Record<string, AudioDefinition> = {
  // buttonClick: { path: 'assets/audio/ui/button_click.mp3', volume: 0.3 },
  // menuOpen: { path: 'assets/audio/ui/menu_open.mp3', volume: 0.4 },
};

/**
 * Background music
 */
export const musicAudio: Record<string, AudioDefinition> = {
  backgroundMusic: { path: 'assets/audio/music/adorable_adventures.mp3', volume: 0.3, loop: true },
  battleMusic: { path: 'assets/audio/music/battle_of_gods.mp3', volume: 0.4, loop: true },
};

/**
 * Complete audio configuration
 */
const audioConfig: AudioConfig = {
  audio: {
    skills: skillEffectAudio,
    ui: uiAudio,
    music: musicAudio,
  },
} as const;

// Export both the full config and individual parts for flexibility
export default audioConfig;

// Type exports for better type inference
export type SkillEffectAudioKey = keyof typeof skillEffectAudio;
export type UIAudioKey = keyof typeof uiAudio;
export type MusicAudioKey = keyof typeof musicAudio;