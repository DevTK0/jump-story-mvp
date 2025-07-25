import Phaser from 'phaser';

export enum CoreGameEvent {
  // Combat events (cross-entity)
  DAMAGE_DEALT = 'combat:damage:dealt',
  PROJECTILE_FIRED = 'combat:projectile:fired',
}

export interface CoreGameEventData {
  [CoreGameEvent.DAMAGE_DEALT]: { source: string; target: string; damage: number };
  [CoreGameEvent.PROJECTILE_FIRED]: {
    type: string;
    position: { x: number; y: number };
    direction: number;
  };
}

export class TypedEventEmitter extends Phaser.Events.EventEmitter {
  emit<K extends string>(event: K, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends string>(event: K, fn: (...args: any[]) => void, context?: any): this {
    return super.on(event, fn, context);
  }

  once<K extends string>(event: K, fn: (...args: any[]) => void, context?: any): this {
    return super.once(event, fn, context);
  }

  off<K extends string>(event: K, fn?: (...args: any[]) => void, context?: any): this {
    return super.off(event, fn, context);
  }
}

export const gameEvents = new TypedEventEmitter();
