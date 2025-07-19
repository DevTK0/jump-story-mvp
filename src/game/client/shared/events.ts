import Phaser from 'phaser';

export enum GameEvent {
  // Player events
  PLAYER_DAMAGED = 'player:damaged',
  PLAYER_DIED = 'player:died',
  PLAYER_ATTACKED = 'player:attacked',
  PLAYER_JUMP = 'player:jump',
  PLAYER_CLIMB_START = 'player:climb:start',
  PLAYER_CLIMB_END = 'player:climb:end',
  
  // Enemy events
  ENEMY_SPAWNED = 'enemy:spawned',
  ENEMY_DIED = 'enemy:died',
  ENEMY_DAMAGED = 'enemy:damaged',
  
  // Combat events
  DAMAGE_DEALT = 'combat:damage:dealt',
  PROJECTILE_FIRED = 'combat:projectile:fired',
  
  // UI events
  UI_UPDATE_HEALTH = 'ui:update:health',
  UI_UPDATE_SCORE = 'ui:update:score',
}

export interface GameEventData {
  [GameEvent.PLAYER_DAMAGED]: { damage: number; health: number };
  [GameEvent.PLAYER_DIED]: { position: { x: number; y: number } };
  [GameEvent.PLAYER_ATTACKED]: { type: 'melee' | 'ranged'; direction: number; attackType?: number };
  [GameEvent.PLAYER_JUMP]: { velocity: number };
  [GameEvent.PLAYER_CLIMB_START]: { climbableObject: Phaser.GameObjects.GameObject };
  [GameEvent.PLAYER_CLIMB_END]: void;
  
  [GameEvent.ENEMY_SPAWNED]: { id: string; type: string; position: { x: number; y: number } };
  [GameEvent.ENEMY_DIED]: { id: string; killer?: string };
  [GameEvent.ENEMY_DAMAGED]: { id: string; damage: number; health: number };
  
  [GameEvent.DAMAGE_DEALT]: { source: string; target: string; damage: number };
  [GameEvent.PROJECTILE_FIRED]: { type: string; position: { x: number; y: number }; direction: number };
  
  [GameEvent.UI_UPDATE_HEALTH]: { current: number; max: number };
  [GameEvent.UI_UPDATE_SCORE]: { score: number };
}

export class TypedEventEmitter extends Phaser.Events.EventEmitter {
  emit<K extends GameEvent>(event: K, ...args: GameEventData[K] extends void ? [] : [GameEventData[K]]): boolean {
    return super.emit(event, ...args);
  }
  
  on<K extends GameEvent>(
    event: K,
    fn: GameEventData[K] extends void ? () => void : (data: GameEventData[K]) => void,
    context?: any
  ): this {
    return super.on(event, fn, context);
  }
  
  once<K extends GameEvent>(
    event: K,
    fn: GameEventData[K] extends void ? () => void : (data: GameEventData[K]) => void,
    context?: any
  ): this {
    return super.once(event, fn, context);
  }
  
  off<K extends GameEvent>(
    event: K,
    fn?: GameEventData[K] extends void ? () => void : (data: GameEventData[K]) => void,
    context?: any
  ): this {
    return super.off(event, fn, context);
  }
}

export const gameEvents = new TypedEventEmitter();