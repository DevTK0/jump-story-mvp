import Phaser from 'phaser';
import type { PlayerState, System } from '../../shared/types';
import { gameEvents, GameEvent } from '../../shared/events';
import { PLAYER_CONFIG } from './config';

export interface PlayerConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  texture: string;
  frame?: string | number;
}

export class Player extends Phaser.GameObjects.Sprite {
  private playerState: PlayerState;
  private systems: Map<string, System> = new Map();
  
  // Physics body reference for convenience
  public body!: Phaser.Physics.Arcade.Body;
  
  // Input references
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: {
    c: Phaser.Input.Keyboard.Key;
    x: Phaser.Input.Keyboard.Key;
    v: Phaser.Input.Keyboard.Key;
    z: Phaser.Input.Keyboard.Key;
  };

  constructor(config: PlayerConfig) {
    super(config.scene, config.x, config.y, config.texture, config.frame);
    
    // Add to scene
    config.scene.add.existing(this);
    config.scene.physics.add.existing(this);
    
    // Type-cast body
    this.body = this.body as Phaser.Physics.Arcade.Body;
    
    // Initialize state
    this.playerState = {
      health: 100,
      maxHealth: 100,
      isAlive: true,
      isClimbing: false,
      isAttacking: false,
      canJump: true,
      facingDirection: 1,
    };
    
    // Setup input
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    this.keys = {
      c: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      x: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      v: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V),
      z: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    };
    
    // Setup physics properties
    this.setupPhysics();
  }
  
  private setupPhysics(): void {
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
    if (!this.playerState.isAlive) return;
    
    // Update all registered systems
    for (const system of this.systems.values()) {
      system.update(time, delta);
    }
    
    // Update visual representation
    this.updateVisual();
  }
  
  private updateVisual(): void {
    // Flip sprite based on facing direction
    this.setFlipX(this.playerState.facingDirection === -1);
  }
  
  // State getters and setters
  public getPlayerState(): Readonly<PlayerState> {
    return { ...this.playerState };
  }
  
  public setPlayerState(updates: Partial<PlayerState>): void {
    const oldHealth = this.playerState.health;
    this.playerState = { ...this.playerState, ...updates };
    
    // Emit events for state changes
    if (updates.health !== undefined && updates.health < oldHealth) {
      gameEvents.emit(GameEvent.PLAYER_DAMAGED, {
        damage: oldHealth - updates.health,
        health: updates.health,
      });
    }
    
    if (updates.health !== undefined && updates.health <= 0 && this.playerState.isAlive) {
      this.playerState.isAlive = false;
      gameEvents.emit(GameEvent.PLAYER_DIED, {
        position: { x: this.x, y: this.y },
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
  
  public get isAlive(): boolean {
    return this.playerState.isAlive;
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
    return PLAYER_CONFIG.movement.speed;
  }
  
  public getJumpSpeed(): number {
    return PLAYER_CONFIG.movement.jumpSpeed;
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