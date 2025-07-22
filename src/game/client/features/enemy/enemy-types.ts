import type { EntityState } from '../core/types';

export interface EnemyState extends EntityState {
  aggro: boolean;
  target: Phaser.GameObjects.GameObject | null;
  patrolDirection: 1 | -1;
}