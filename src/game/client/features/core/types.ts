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

export interface System {
  update(time: number, delta: number): void;
  destroy?(): void;
}