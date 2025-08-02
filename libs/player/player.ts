import Phaser from 'phaser';
import type { System } from '../core/types';
import { emitSceneEvent } from '../core/scene';
import type { PlayerState } from './player-types';
import { PLAYER_CONFIG } from './config';
import { PlayerStateMachine } from './state/state-machine';
import type { PhysicsEntity } from '@/core/physics/physics-entity';
import type { PhysicsRegistry } from '@/core/physics/physics-registry';
import type { CombatSystemEnhanced } from './combat/combat-enhanced';
import type { JobConfig } from './combat/attack-types';
import jobAttributesConfig from '../../apps/playground/config/job-attributes';

export interface PlayerConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  texture: string;
  frame?: string | number;
}

export class Player extends Phaser.GameObjects.Sprite implements PhysicsEntity {
  private playerState: PlayerState;
  private _jobConfig: JobConfig;
  private systems: Map<string, System> = new Map();
  private stateMachine!: PlayerStateMachine; // Will be initialized by PlayerBuilder

  // Physics body reference for convenience
  public body!: Phaser.Physics.Arcade.Body;

  // Chat system flag
  public chatActive: boolean = false;

  // Input references
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys; // Will be initialized by PlayerBuilder
  private keys!: {
    c: Phaser.Input.Keyboard.Key;
    x: Phaser.Input.Keyboard.Key;
    v: Phaser.Input.Keyboard.Key;
    z: Phaser.Input.Keyboard.Key;
    r: Phaser.Input.Keyboard.Key;
    t: Phaser.Input.Keyboard.Key;
    e: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };

  // Static factory method for PlayerBuilder to use
  public static create(config: PlayerConfig): Player {
    return new Player(config);
  }

  private constructor(config: PlayerConfig) {
    super(config.scene, config.x, config.y, config.texture, config.frame);

    // Add to scene
    config.scene.add.existing(this);
    config.scene.physics.add.existing(this);

    // Type-cast body
    const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
    this.body = arcadeBody;

    // Set jobConfig
    const playerJob = config.texture || 'soldier';
    this._jobConfig = jobAttributesConfig.jobs[playerJob] || jobAttributesConfig.jobs.soldier;

    // Initialize with default state - PlayerBuilder will configure the rest
    this.playerState = this.createDefaultPlayerState();

    // Setup physics properties
    this.setupPhysicsBody();

    // State machine will be initialized by PlayerBuilder
  }

  private createDefaultPlayerState(): PlayerState {
    return {
      health: 100,
      maxHealth: 100,
      isAlive: true,
      isClimbing: false,
      isAttacking: false,
      isDashing: false,
      canJump: true,
      facingDirection: 1,
    };
  }

  // Initialize input - called by PlayerBuilder
  public initializeInput(): void {
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    this.keys = {
      c: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      x: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      v: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V),
      z: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      r: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      t: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T),
      e: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      space: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  // Initialize state machine - called by PlayerBuilder
  public initializeStateMachine(): void {
    this.stateMachine = new PlayerStateMachine(this);
  }

  private setupPhysicsBody(): void {
    this.body.setSize(14, 30);
    this.body.setOffset(9, 2);
    this.body.setCollideWorldBounds(true);
  }

  public registerSystem(name: string, system: System): void {
    this.systems.set(name, system);
  }

  public getSystem<T extends System>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  public update(time: number, delta: number): void {
    // Update state machine
    this.stateMachine.update(time, delta);

    // Update all registered systems
    for (const system of this.systems.values()) {
      system.update(time, delta);
    }

    // Update visual representation
    this.updateVisual();
  }

  private updateVisual(): void {
    // Don't update visual if dead
    if (this.stateMachine.isInState('Dead')) {
      return;
    }

    // Flip sprite based on facing direction
    this.setFlipX(this.playerState.facingDirection === -1);
  }

  public set jobConfig (newJobConfig: JobConfig) {
    this._jobConfig = newJobConfig;
  }

  public get jobConfig (): JobConfig {
    return JSON.parse(JSON.stringify(this._jobConfig)) as JobConfig;
  }

  // State getters and setters
  public getPlayerState(): Readonly<PlayerState> {
    return { ...this.playerState };
  }

  public setPlayerState(updates: Partial<PlayerState>): void {
    this.playerState = { ...this.playerState, ...updates };

    // Health change is handled by game systems directly

    if (updates.health !== undefined && updates.health <= 0 && this.playerState.isAlive) {
      this.playerState.isAlive = false;
      // Emit death event using type-safe scene events
      emitSceneEvent(this.scene, 'player:died', {
        position: { x: this.x, y: this.y }
      });
    }
  }

  // Convenience methods
  public get facingDirection(): 1 | -1 {
    return this.playerState.facingDirection;
  }

  public set facingDirection(direction: 1 | -1) {
    this.setPlayerState({ facingDirection: direction });
  }

  public get isClimbing(): boolean {
    return this.playerState.isClimbing;
  }

  public get isAttacking(): boolean {
    return this.playerState.isAttacking;
  }

  public get isDashing(): boolean {
    return this.playerState.isDashing;
  }

  public get isAlive(): boolean {
    return this.playerState.isAlive;
  }

  public set isAlive (value: boolean) {
    this.playerState.isAlive = value;
  }

  // State machine methods
  public getStateMachine(): PlayerStateMachine {
    return this.stateMachine;
  }

  public getCurrentStateName(): string {
    return this.stateMachine.getCurrentStateName();
  }

  public transitionToState(stateName: string): boolean {
    return this.stateMachine.transitionTo(stateName);
  }

  public isInState(stateName: string): boolean {
    return this.stateMachine.isInState(stateName);
  }

  public takeDamage(amount: number): void {
    if (!this.playerState.isAlive) return;

    const newHealth = Math.max(0, this.playerState.health - amount);
    this.setPlayerState({ health: newHealth });
  }

  public heal(amount: number): void {
    if (!this.playerState.isAlive) return;

    const newHealth = Math.min(this.playerState.maxHealth, this.playerState.health + amount);
    this.setPlayerState({ health: newHealth });
  }

  // Input accessors for systems
  public getCursors(): Phaser.Types.Input.Keyboard.CursorKeys {
    return this.cursors;
  }

  public getKeys() {
    return this.keys;
  }

  // Config accessors
  public getSpeed(): number {
    // Try to get job-specific move speed from combat system
    const combatSystem = this.getSystem('combat') as CombatSystemEnhanced;
    if (combatSystem?.getJobConfig) {
      const jobConfig = combatSystem.getJobConfig();
      if (jobConfig?.baseStats?.moveSpeed) {
        return jobConfig.baseStats.moveSpeed;
      }
    }
    
    // Fallback to default config if job speed not available
    return PLAYER_CONFIG.movement.speed;
  }

  public getJumpSpeed(): number {
    return PLAYER_CONFIG.movement.jumpSpeed;
  }

  // PhysicsEntity implementation
  public setupPhysics(registry: PhysicsRegistry): void {
    // Register collisions with ground (solid collision)
    registry.addCollider(this, 'ground');
    
    // Register collisions with platforms (one-way)
    registry.addCollider(this, 'platforms', undefined, registry.createOneWayPlatformCallback());
    
    // Register collisions with boundaries
    registry.addCollider(this, 'boundaries');
    
    // Register overlap with climbeable objects (no collision, just detection)
    registry.addOverlap(this, 'climbeable', (_player, _climbeable) => {
      // Climbeable interaction handled by ClimbingSystem
    });
    
    // Register overlap with enemies (for damage)
    // This will be handled by InteractionHandler which will call registry methods
    
    // Let climbing system know about climbeable group if it exists
    const climbingSystem = this.getSystem('climbing');
    if (climbingSystem && 'setClimbeableGroup' in climbingSystem) {
      const climbeableGroup = registry.getGroup('climbeable');
      if (climbeableGroup) {
        (climbingSystem as any).setClimbeableGroup(climbeableGroup);
      }
    }
  }

  public getPhysicsBody(): Phaser.Physics.Arcade.Body {
    return this.body;
  }

  public destroy(): void {
    // Destroy all systems
    for (const system of this.systems.values()) {
      if (system.destroy) {
        system.destroy();
      }
    }
    this.systems.clear();

    // Call parent destroy
    super.destroy();
  }
}
