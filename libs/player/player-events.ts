import Phaser from 'phaser';

export enum PlayerEvent {
  // Player events
  PLAYER_DAMAGED = 'player:damaged',
  PLAYER_DIED = 'player:died',
  PLAYER_ATTACKED = 'player:attacked',
  PLAYER_JUMP = 'player:jump',
  PLAYER_CLIMB_START = 'player:climb:start',
  PLAYER_CLIMB_END = 'player:climb:end',
  
  // UI events (player-related)
  UI_UPDATE_HEALTH = 'ui:update:health',
  UI_UPDATE_SCORE = 'ui:update:score',
}

export interface PlayerEventData {
  [PlayerEvent.PLAYER_DAMAGED]: { damage: number; health: number };
  [PlayerEvent.PLAYER_DIED]: { position: { x: number; y: number } };
  [PlayerEvent.PLAYER_ATTACKED]: { type: 'melee' | 'ranged'; direction: number; attackType?: number };
  [PlayerEvent.PLAYER_JUMP]: { velocity: number };
  [PlayerEvent.PLAYER_CLIMB_START]: { climbableObject: Phaser.GameObjects.GameObject };
  [PlayerEvent.PLAYER_CLIMB_END]: void;
  
  [PlayerEvent.UI_UPDATE_HEALTH]: { current: number; max: number };
  [PlayerEvent.UI_UPDATE_SCORE]: { score: number };
}