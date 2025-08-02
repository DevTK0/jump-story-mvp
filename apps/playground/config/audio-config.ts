/**
 * This file handles the sound effects used in the game.
 */
import type { AudioConfig, AudioDefinition } from '@/core';

/**
 * Skill effect audio definitions
 */
export const skillEffectAudio: Record<string, AudioDefinition> = {
  p_att_phys: {
    path: 'assets/audio/skills/P_Att_Phys.ogg',
    volume: 0.5,
    loop: false,
  },
  p_att_magic: {
    path: 'assets/audio/skills/P_Att_Magic.ogg',
    volume: 0.5,
    loop: false,
  },
  p_att_ice: {
    path: 'assets/audio/skills/P_Att_Ice.ogg',
    volume: 0.5,
    loop: false,
  },
  p_att_fire: {
    path: 'assets/audio/skills/P_Att_Fire.ogg',
    volume: 0.5,
    loop: false,
  },
  p_att_arrow: {
    path: 'assets/audio/skills/P_Att_Arrow.ogg',
    volume: 0.5,
    loop: false,
  },
  p_att_heal: {
    path: 'assets/audio/skills/P_Att_Heal.ogg',
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
  hit: { path: 'assets/audio/skills/P_Hit.ogg', volume: 0.5, loop: false },
  death: { path: 'assets/audio/skills/P_Die.ogg', volume: 0.5, loop: false },
  respawn: { path: 'assets/audio/skills/P_Resu.ogg', volume: 0.5, loop: false },
  classChange: { path: 'assets/audio/skills/P_Class.wav', volume: 0.5, loop: false },
  jump: { path: 'assets/audio/skills/P_Jump.ogg', volume: 0.3, loop: false },
  teleportUnlock: { path: 'assets/audio/skills/P_Teleport.ogg', volume: 0.5, loop: false },
  levelup: { path: 'assets/audio/skills/P_Level.wav', volume: 0.5, loop: false },
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
  enemyHitBone: { path: 'assets/audio/skills/E_Hit_Bone.ogg', volume: 0.3, loop: false },
  enemyHitFlesh: { path: 'assets/audio/skills/E_Hit_Flesh.ogg', volume: 0.3, loop: false },
  enemyHitSlime: { path: 'assets/audio/skills/E_Hit_Slime.ogg', volume: 0.3, loop: false },
  enemyHitArmor: { path: 'assets/audio/skills/E_Hit_Armor.ogg', volume: 0.3, loop: false },
  enemyDeathGeneric: { path: 'assets/audio/skills/E_Die_Generic.ogg', volume: 0.4, loop: false },
  enemyDeathSlime: { path: 'assets/audio/skills/E_Die_Slime.ogg', volume: 0.4, loop: false },
  enemyDeathBone: { path: 'assets/audio/skills/E_Die_Bone.ogg', volume: 0.4, loop: false },
  bossHitBone: { path: 'assets/audio/skills/E_Hit_Bone.ogg', volume: 0.5, loop: false },
  bossHitFlesh: { path: 'assets/audio/skills/E_Hit_Flesh.ogg', volume: 0.5, loop: false },
  bossHitSlime: { path: 'assets/audio/skills/E_Hit_Slime.ogg', volume: 0.5, loop: false },
  bossHitArmor: { path: 'assets/audio/skills/E_Hit_Armor.ogg', volume: 0.5, loop: false },
  bossDeathGeneric: { path: 'assets/audio/skills/E_Die_Generic.ogg', volume: 0.6, loop: false },
  bossDeathSlime: { path: 'assets/audio/skills/E_Die_Slime.ogg', volume: 0.6, loop: false },
  bossDeathBone: { path: 'assets/audio/skills/E_Die_Bone.ogg', volume: 0.6, loop: false },
  bossAttackGeneric: { path: 'assets/audio/skills/B_Att_Generic.ogg', volume: 0.6, loop: false },
  bossAttackArrow: { path: 'assets/audio/skills/B_Att_Arrow.ogg', volume: 0.6, loop: false },
  bossAttackPhys: { path: 'assets/audio/skills/B_Att_Phys.ogg', volume: 0.6, loop: false },
  bossAttackMagic: { path: 'assets/audio/skills/B_Att_Magic.ogg', volume: 0.6, loop: false },
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
