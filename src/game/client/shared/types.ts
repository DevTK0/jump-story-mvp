export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface EntityState {
  health: number;
  maxHealth: number;
  isAlive: boolean;
}

export interface PlayerState extends EntityState {
  isClimbing: boolean;
  isAttacking: boolean;
  canJump: boolean;
  facingDirection: 1 | -1;
}

export interface EnemyState extends EntityState {
  aggro: boolean;
  target: Phaser.GameObjects.GameObject | null;
  patrolDirection: 1 | -1;
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
}

export interface System {
  update(time: number, delta: number): void;
  destroy?(): void;
}