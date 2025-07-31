import { PlayerState as DbPlayerState } from '@/spacetime/client';
import { spriteConfigLoader } from '@/core/asset/sprite-config-loader';

/**
 * Base class for all enemy states
 * Manages state-specific behavior and transitions for enemies
 */
export abstract class EnemyState {
  protected spawnId: number;
  protected sprite: Phaser.Physics.Arcade.Sprite;
  protected enemy: string;
  protected stateMachine: EnemyStateMachine;

  constructor(
    spawnId: number,
    sprite: Phaser.Physics.Arcade.Sprite,
    enemy: string,
    stateMachine: EnemyStateMachine
  ) {
    this.spawnId = spawnId;
    this.sprite = sprite;
    this.enemy = enemy;
    this.stateMachine = stateMachine;
  }

  /**
   * Called when entering this state
   */
  abstract onEnter(previousState?: EnemyState): void;

  /**
   * Called when exiting this state
   */
  abstract onExit(nextState?: EnemyState): void;

  /**
   * Called every frame while in this state
   */
  abstract update(time: number, delta: number): void;

  /**
   * Handle animation complete events
   */
  onAnimationComplete?(animation: Phaser.Animations.Animation): void;

  /**
   * Get the corresponding database state
   */
  abstract getDbState(): DbPlayerState;

  /**
   * Get the state name for debugging
   */
  abstract getName(): string;

  /**
   * Check if transition to another state is allowed
   */
  canTransitionTo(stateName: string): boolean {
    return this.getAllowedTransitions().includes(stateName);
  }

  /**
   * Get list of states this state can transition to
   */
  protected abstract getAllowedTransitions(): string[];

  /**
   * Update sprite reference if needed (for when enemy is recreated)
   */
  updateSprite(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.sprite = sprite;
  }
}

/**
 * Idle state - enemy is standing still or patrolling
 */
export class EnemyIdleState extends EnemyState {
  onEnter(_previousState?: EnemyState): void {
    this.sprite.play(`${this.enemy}-idle-anim`);
  }

  onExit(_nextState?: EnemyState): void {
    // No cleanup needed
  }

  update(_time: number, _delta: number): void {
    // Idle behavior handled by server
  }

  getDbState(): DbPlayerState {
    return { tag: 'Idle' };
  }

  getName(): string {
    return 'Idle';
  }

  protected getAllowedTransitions(): string[] {
    return ['Walk', 'Attack1', 'Attack2', 'Attack3', 'Damaged', 'Dead'];
  }
}

/**
 * Walk state - enemy is moving/patrolling
 */
export class EnemyWalkState extends EnemyState {
  onEnter(_previousState?: EnemyState): void {
    // Try to play walk animation, fallback to idle if not available
    const walkAnimKey = `${this.enemy}-walk-anim`;
    
    if (this.sprite.anims && this.sprite.anims.exists(walkAnimKey)) {
      this.sprite.play(walkAnimKey);
    } else {
      // Fallback to idle animation
      this.sprite.play(`${this.enemy}-idle-anim`);
    }
  }

  onExit(_nextState?: EnemyState): void {
    // No cleanup needed
  }

  update(_time: number, _delta: number): void {
    // Movement handled by server
  }

  getDbState(): DbPlayerState {
    return { tag: 'Walk' };
  }

  getName(): string {
    return 'Walk';
  }

  protected getAllowedTransitions(): string[] {
    return ['Idle', 'Attack1', 'Attack2', 'Attack3', 'Damaged', 'Dead'];
  }
}

/**
 * Damaged state - enemy has taken damage
 */
export class EnemyDamagedState extends EnemyState {
  private animationCompleteListener?: Function;

  onEnter(_previousState?: EnemyState): void {
    // Play damaged animation
    this.sprite.play(`${this.enemy}-damaged-anim`);

    // Set up animation complete listener
    this.animationCompleteListener = (animation: Phaser.Animations.Animation) => {
      if (animation.key === `${this.enemy}-damaged-anim`) {
        // Only transition back to idle if we're still in damaged state
        if (this.stateMachine.getCurrentStateName() === 'Damaged') {
          this.stateMachine.transitionTo('Idle');
        }
      }
    };

    this.sprite.on('animationcomplete', this.animationCompleteListener);
  }

  onExit(_nextState?: EnemyState): void {
    // Clean up animation listener
    if (this.animationCompleteListener) {
      this.sprite.off('animationcomplete', this.animationCompleteListener);
      this.animationCompleteListener = undefined;
    }
  }

  update(_time: number, _delta: number): void {
    // Damaged state recovery is handled by server
  }

  getDbState(): DbPlayerState {
    return { tag: 'Damaged' };
  }

  getName(): string {
    return 'Damaged';
  }

  protected getAllowedTransitions(): string[] {
    return ['Idle', 'Dead'];
  }
}

/**
 * Attack1 state - enemy is performing attack1
 */
export class EnemyAttack1State extends EnemyState {
  private animationCompleteListener?: Function;

  onEnter(_previousState?: EnemyState): void {
    this.sprite.play(`${this.enemy}-attack1-anim`);

    // Set up animation complete listener
    this.animationCompleteListener = (animation: Phaser.Animations.Animation) => {
      if (animation.key === `${this.enemy}-attack1-anim`) {
        // Animation finished - for bosses, this is just visual
        // Server will handle state transitions
      }
    };

    this.sprite.on('animationcomplete', this.animationCompleteListener);
  }

  onExit(_nextState?: EnemyState): void {
    // Clean up animation listener
    if (this.animationCompleteListener) {
      this.sprite.off('animationcomplete', this.animationCompleteListener);
      this.animationCompleteListener = undefined;
    }
  }

  update(_time: number, _delta: number): void {
    // Attack state managed by server
  }

  getDbState(): DbPlayerState {
    return { tag: 'Attack1' };
  }

  getName(): string {
    return 'Attack1';
  }

  protected getAllowedTransitions(): string[] {
    return ['Idle', 'Walk', 'Damaged', 'Dead'];
  }
}

/**
 * Attack2 state - enemy is performing attack2
 */
export class EnemyAttack2State extends EnemyState {
  private animationCompleteListener?: Function;

  onEnter(_previousState?: EnemyState): void {
    this.sprite.play(`${this.enemy}-attack2-anim`);

    // Set up animation complete listener
    this.animationCompleteListener = (animation: Phaser.Animations.Animation) => {
      if (animation.key === `${this.enemy}-attack2-anim`) {
        // Animation finished - for bosses, this is just visual
        // Server will handle state transitions
      }
    };

    this.sprite.on('animationcomplete', this.animationCompleteListener);
  }

  onExit(_nextState?: EnemyState): void {
    // Clean up animation listener
    if (this.animationCompleteListener) {
      this.sprite.off('animationcomplete', this.animationCompleteListener);
      this.animationCompleteListener = undefined;
    }
  }

  update(_time: number, _delta: number): void {
    // Attack state managed by server
  }

  getDbState(): DbPlayerState {
    return { tag: 'Attack2' };
  }

  getName(): string {
    return 'Attack2';
  }

  protected getAllowedTransitions(): string[] {
    return ['Idle', 'Walk', 'Damaged', 'Dead'];
  }
}

/**
 * Attack3 state - enemy is performing attack3
 */
export class EnemyAttack3State extends EnemyState {
  private animationCompleteListener?: Function;

  onEnter(_previousState?: EnemyState): void {
    this.sprite.play(`${this.enemy}-attack3-anim`);

    // Set up animation complete listener
    this.animationCompleteListener = (animation: Phaser.Animations.Animation) => {
      if (animation.key === `${this.enemy}-attack3-anim`) {
        // Animation finished - for bosses, this is just visual
        // Server will handle state transitions
      }
    };

    this.sprite.on('animationcomplete', this.animationCompleteListener);
  }

  onExit(_nextState?: EnemyState): void {
    // Clean up animation listener
    if (this.animationCompleteListener) {
      this.sprite.off('animationcomplete', this.animationCompleteListener);
      this.animationCompleteListener = undefined;
    }
  }

  update(_time: number, _delta: number): void {
    // Attack state managed by server
  }

  getDbState(): DbPlayerState {
    return { tag: 'Attack3' };
  }

  getName(): string {
    return 'Attack3';
  }

  protected getAllowedTransitions(): string[] {
    return ['Idle', 'Walk', 'Damaged', 'Dead'];
  }
}

/**
 * Dead state - enemy has been defeated
 */
export class EnemyDeadState extends EnemyState {
  private animationCompleteListener?: Function;

  onEnter(_previousState?: EnemyState): void {
    // Cancel any ongoing animations
    this.sprite.anims.stop();

    // Play death animation
    this.sprite.play(`${this.enemy}-death-anim`);

    // Set up animation complete listener
    this.animationCompleteListener = () => {
      if (this.sprite.active) {
        this.setDeadVisuals();
      }
    };

    this.sprite.once('animationcomplete', this.animationCompleteListener);

    // Handle physics for falling
    if (this.sprite.body) {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(0);
      body.setImmovable(false);

      // Disable physics after a short delay
      this.stateMachine.scene.time.delayedCall(1000, () => {
        if (this.sprite.body) {
          const body = this.sprite.body as Phaser.Physics.Arcade.Body;
          body.setVelocity(0, 0);
          body.setEnable(false);
        }
      });
    }
  }

  onExit(_nextState?: EnemyState): void {
    // Clean up animation listener if it exists
    if (this.animationCompleteListener) {
      this.sprite.off('animationcomplete', this.animationCompleteListener);
      this.animationCompleteListener = undefined;
    }
  }

  update(_time: number, _delta: number): void {
    // Dead state has no updates
  }

  private setDeadVisuals(): void {
    // Stop animation and keep on last frame
    this.sprite.anims.stop();

    // Get the death animation config from sprite config
    const enemySprite = spriteConfigLoader.getSpriteDefinition('enemies', this.enemy);
    let deathFrame = 0; // Default to first frame if not found
    
    if (enemySprite && enemySprite.animations && 'death' in enemySprite.animations) {
      const deathAnim = enemySprite.animations.death;
      if (deathAnim && 'end' in deathAnim) {
        deathFrame = deathAnim.end;
      }
    }
    
    // If sprite config isn't loaded or enemy not found, log warning
    if (deathFrame === 0 && this.enemy !== 'unknown') {
      console.warn(`Death frame not found for enemy type: ${this.enemy}`);
    }
    
    this.sprite.setFrame(deathFrame);

    // Apply death tint
    this.sprite.setTint(0x666666);
    this.sprite.setAlpha(0.8);
  }

  getDbState(): DbPlayerState {
    return { tag: 'Dead' };
  }

  getName(): string {
    return 'Dead';
  }

  protected getAllowedTransitions(): string[] {
    return []; // Dead is a terminal state
  }
}

/**
 * Enemy State Machine
 * Manages state transitions and ensures proper animation handling
 */
export class EnemyStateMachine {
  private states: Map<string, EnemyState> = new Map();
  private currentState: EnemyState | null = null;
  private spawnId: number;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private enemy: string;
  public readonly scene: Phaser.Scene;

  constructor(
    spawnId: number,
    sprite: Phaser.Physics.Arcade.Sprite,
    enemy: string,
    scene: Phaser.Scene,
    initialState: DbPlayerState
  ) {
    this.spawnId = spawnId;
    this.sprite = sprite;
    this.enemy = enemy;
    this.scene = scene;

    // Initialize all states
    this.initializeStates();

    // Set initial state without transition
    const stateName = this.getStateNameFromDb(initialState);
    const state = this.states.get(stateName);
    if (state) {
      this.currentState = state;
      state.onEnter();
    }
  }

  private initializeStates(): void {
    // Create all possible states
    this.states.set('Idle', new EnemyIdleState(this.spawnId, this.sprite, this.enemy, this));
    this.states.set('Walk', new EnemyWalkState(this.spawnId, this.sprite, this.enemy, this));
    this.states.set('Attack1', new EnemyAttack1State(this.spawnId, this.sprite, this.enemy, this));
    this.states.set('Attack2', new EnemyAttack2State(this.spawnId, this.sprite, this.enemy, this));
    this.states.set('Attack3', new EnemyAttack3State(this.spawnId, this.sprite, this.enemy, this));
    this.states.set(
      'Damaged',
      new EnemyDamagedState(this.spawnId, this.sprite, this.enemy, this)
    );
    this.states.set('Dead', new EnemyDeadState(this.spawnId, this.sprite, this.enemy, this));
  }

  /**
   * Update the state machine
   */
  update(time: number, delta: number): void {
    if (this.currentState) {
      this.currentState.update(time, delta);
    }
  }

  /**
   * Transition to a new state
   */
  transitionTo(stateName: string): boolean {
    const newState = this.states.get(stateName);
    if (!newState) {
      console.warn(`State ${stateName} not found in enemy state machine`);
      return false;
    }

    // Check if transition is allowed
    if (this.currentState && !this.currentState.canTransitionTo(stateName)) {
      console.warn(`Cannot transition from ${this.currentState.getName()} to ${stateName}`);
      return false;
    }

    // Exit current state
    if (this.currentState) {
      this.currentState.onExit(newState);
    }

    // Enter new state
    const previousState = this.currentState;
    this.currentState = newState;
    newState.onEnter(previousState || undefined);

    return true;
  }

  /**
   * Handle state change from server update
   */
  handleServerStateChange(dbState: DbPlayerState): void {
    const stateName = this.getStateNameFromDb(dbState);
    if (this.getCurrentStateName() !== stateName) {
      this.transitionTo(stateName);
    }
  }

  /**
   * Play hit animation without changing state
   * Used for damage events that arrive separately from state changes
   */
  playHitAnimation(): void {
    // Only play hit animation if not already dead
    if (this.currentState && this.currentState.getName() !== 'Dead') {
      // If we're already in damaged state, just replay the animation
      if (this.currentState.getName() === 'Damaged') {
        this.sprite.play(`${this.enemy}-damaged-anim`);
      }
      // Otherwise, we'll wait for the state change to handle it
    }
  }

  /**
   * Get current state name
   */
  getCurrentStateName(): string {
    return this.currentState?.getName() || 'Unknown';
  }

  /**
   * Check if in a specific state
   */
  isInState(stateName: string): boolean {
    return this.getCurrentStateName() === stateName;
  }

  /**
   * Update sprite reference (for when enemy sprite is recreated)
   */
  updateSprite(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.sprite = sprite;
    // Update all states with new sprite reference
    for (const state of this.states.values()) {
      state.updateSprite(sprite);
    }
  }

  /**
   * Convert database state to state machine state name
   */
  private getStateNameFromDb(dbState: DbPlayerState): string {
    // Map database states to state machine states
    switch (dbState.tag) {
      case 'Idle':
        return 'Idle';
      case 'Walk':
        return 'Walk';
      case 'Attack1':
        return 'Attack1';
      case 'Attack2':
        return 'Attack2';
      case 'Attack3':
        return 'Attack3';
      case 'Damaged':
        return 'Damaged';
      case 'Dead':
        return 'Dead';
      default:
        console.warn(`Unknown enemy state: ${dbState.tag}, defaulting to Idle`);
        return 'Idle';
    }
  }

  /**
   * Cleanup state machine
   */
  destroy(): void {
    if (this.currentState) {
      this.currentState.onExit();
    }
    this.states.clear();
    this.currentState = null;
  }
}
