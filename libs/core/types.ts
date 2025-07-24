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

/**
 * Base interface for all game systems
 */
export interface System {
  update(time: number, delta: number): void;
  destroy?(): void;
}

/**
 * System that requires database connection
 */
export interface NetworkedSystem extends System {
  setDbConnection?(connection: any): void;
}

/**
 * System that can be debugged
 */
export interface DebuggableSystem extends System {
  renderDebug?(graphics: Phaser.GameObjects.Graphics): void;
  cleanupDebugResources?(): void;
}

/**
 * System that handles player input
 */
export interface InputHandlingSystem extends System {
  handleInput?(input: any): void;
  isInputEnabled?(): boolean;
  setInputEnabled?(enabled: boolean): void;
}

/**
 * System that manages animations
 */
export interface AnimationSystem extends System {
  playAnimation?(animationKey: string): void;
  stopAnimation?(): void;
  isAnimationPlaying?(animationKey?: string): boolean;
  playDamagedAnimation?(knockbackDirection: { x: number; y: number }): boolean;
  isPlayerInvulnerable?(): boolean;
}

/**
 * System that handles combat
 */
export interface CombatSystem extends System {
  attack?(attackType: number): void;
  takeDamage?(amount: number, source?: any): void;
  isAttacking?(): boolean;
  setSyncManager?(syncManager: any): void;
}

/**
 * System that manages movement
 */
export interface MovementSystem extends System {
  setVelocity?(x?: number, y?: number): void;
  stopMovement?(): void;
  isOnGround?(): boolean;
  forceJump?(velocityMultiplier?: number): void;
  setMovementDisabled?(disabled: boolean): void;
  getCurrentFacing?(): any;
}

/**
 * System that manages climbing
 */
export interface ClimbingSystem extends System {
  startClimbing?(ladder: any): void;
  stopClimbing?(): void;
  isClimbing?(): boolean;
}

/**
 * System that manages synchronization
 */
export interface SynchronizationSystem extends NetworkedSystem {
  getSyncManager?(): any;
  forceSync?(): void;
  setMovementSystem?(movementSystem: MovementSystem): void;
}