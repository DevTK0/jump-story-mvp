import type { EntityState } from '../core/types';

export interface PlayerState extends EntityState {
  isClimbing: boolean;
  isAttacking: boolean;
  canJump: boolean;
  facingDirection: 1 | -1;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  attack1: boolean;
  attack2: boolean;
  attack3: boolean;
  respawn: boolean;
  teleport: boolean;
  instakill: boolean;
}
