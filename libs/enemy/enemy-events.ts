export enum EnemyEvent {
  // Enemy events
  ENEMY_SPAWNED = 'enemy:spawned',
  ENEMY_DIED = 'enemy:died',
  ENEMY_DAMAGED = 'enemy:damaged',
}

export interface EnemyEventData {
  [EnemyEvent.ENEMY_SPAWNED]: { id: string; type: string; position: { x: number; y: number } };
  [EnemyEvent.ENEMY_DIED]: { id: string; killer?: string };
  [EnemyEvent.ENEMY_DAMAGED]: { id: string; damage: number; health: number };
}
