import Phaser from 'phaser';
import type { System } from '../../shared/types';
import { gameEvents, GameEvent } from '../../shared/events';
import { Player } from './Player';
import { InputSystem } from './input';
import { MovementSystem } from './movement';
import {
  CLIMB_TOP_BOUNDARY_OFFSET,
  CLIMB_BOTTOM_BOUNDARY_OFFSET,
  CLIMB_BOUNDARY_OFFSET,
  CLIMB_EXIT_PLAYER_OFFSET,
  CLIMB_SPEED,
  CLIMB_GROUND_LEVEL_THRESHOLD,
} from './constants';

export interface ClimbingConfig {
  x: number;
  topY: number;
  bottomY: number;
  width: number;
  climbSpeed: number;
}

export class ClimbingSystem implements System {
  private player: Player;
  private inputSystem: InputSystem;
  private movementSystem: MovementSystem;
  private scene: Phaser.Scene;
  
  // Climbing configuration
  private config: ClimbingConfig | null = null;
  
  // Climbeable areas from tilemap
  private climbeableGroup: Phaser.Physics.Arcade.Group | null = null;
  
  // State
  private originalGravity = 0;
  private climbingKeyStates = { up: false, down: false };
  
  constructor(
    player: Player,
    inputSystem: InputSystem,
    movementSystem: MovementSystem,
    scene: Phaser.Scene
  ) {
    this.player = player;
    this.inputSystem = inputSystem;
    this.movementSystem = movementSystem;
    this.scene = scene;
  }
  
  // Set up climbeable areas from tilemap
  public setClimbeableGroup(group: Phaser.Physics.Arcade.Group): void {
    this.climbeableGroup = group;
  }
  
  // Legacy config support
  public setConfig(config: ClimbingConfig): void {
    this.config = config;
  }
  
  update(_time: number, _delta: number): void {
    
    // Update climbing key states
    if (this.inputSystem.isJustPressed('up')) {
      this.climbingKeyStates.up = true;
    }
    if (this.inputSystem.isJustReleased('up')) {
      this.climbingKeyStates.up = false;
    }
    if (this.inputSystem.isJustPressed('down')) {
      this.climbingKeyStates.down = true;
    }
    if (this.inputSystem.isJustReleased('down')) {
      this.climbingKeyStates.down = false;
    }
    
    if (this.player.isClimbing) {
      this.updateClimbing();
      this.handleClimbingExit();
    } else {
      this.checkClimbingStart();
    }
  }
  
  private checkClimbingStart(): void {
    const inputState = this.inputSystem.getInputState();
    const onGround = this.movementSystem.isOnGround();
    const inClimbeableArea = this.isInClimbeableArea();
    
    // Check for climbing initiation
    if (
      inputState.up &&
      inClimbeableArea &&
      this.player.y > CLIMB_GROUND_LEVEL_THRESHOLD
    ) {
      this.startClimbing();
    }
    
    // Check for climbing descent from ground
    if (
      inputState.down &&
      onGround &&
      inClimbeableArea
    ) {
      this.startClimbing();
    }
  }
  
  private updateClimbing(): void {
    if (!this.player.isClimbing) return;
    
    const body = this.player.body;
    let targetVelocityY = 0;
    
    // Use config if available (legacy support)
    if (this.config) {
      if (
        this.climbingKeyStates.up &&
        this.player.y > this.config.topY - CLIMB_TOP_BOUNDARY_OFFSET
      ) {
        targetVelocityY = -this.config.climbSpeed;
      } else if (
        this.climbingKeyStates.down &&
        this.player.y < this.config.bottomY + CLIMB_BOUNDARY_OFFSET
      ) {
        targetVelocityY = this.config.climbSpeed;
      }
      
      // Keep player centered on climbing surface
      this.player.x = this.config.x;
      body.setVelocity(0, targetVelocityY);
      
      // Check boundaries
      if (this.player.y <= this.config.topY - CLIMB_EXIT_PLAYER_OFFSET) {
        this.player.y = this.config.topY - CLIMB_EXIT_PLAYER_OFFSET;
        this.exitClimbing();
      } else if (
        this.player.y >= this.config.bottomY - CLIMB_EXIT_PLAYER_OFFSET
      ) {
        this.player.y = this.config.bottomY - CLIMB_EXIT_PLAYER_OFFSET;
        this.exitClimbing();
      }
    } else {
      // Map-based climbing
      if (this.climbingKeyStates.up) {
        targetVelocityY = -CLIMB_SPEED;
      } else if (this.climbingKeyStates.down) {
        targetVelocityY = CLIMB_SPEED;
      }
      
      body.setVelocity(0, targetVelocityY);
    }
  }
  
  private handleClimbingExit(): void {
    const inputState = this.inputSystem.getInputState();
    
    // Jump off climbeable surface
    if (inputState.jump) {
      const horizontalDir = this.inputSystem.getHorizontalDirection();
      
      this.exitClimbing();
      this.climbingKeyStates = { up: false, down: false };
      
      // Apply jump
      this.movementSystem.forceJump();
      
      // Apply horizontal velocity
      if (horizontalDir !== 0) {
        this.movementSystem.setVelocity(horizontalDir * this.player.getSpeed());
        this.player.facingDirection = horizontalDir as 1 | -1;
      }
    }
  }
  
  private startClimbing(): void {
    this.player.setPlayerState({ isClimbing: true });
    
    // Store and disable gravity
    const body = this.player.body;
    this.originalGravity = body.gravity.y;
    body.setGravityY(0);
    body.setVelocity(0, 0);
    
    // Snap to climbing position if using config
    if (this.config) {
      this.player.x = this.config.x;
    }
    
    gameEvents.emit(GameEvent.PLAYER_CLIMB_START, {
      climbableObject: this.player,
    });
  }
  
  private exitClimbing(): void {
    if (!this.player.isClimbing) return;
    
    this.player.setPlayerState({ isClimbing: false });
    
    // Restore gravity
    const body = this.player.body;
    body.setGravityY(this.originalGravity);
    body.setVelocity(0, 0);
    
    gameEvents.emit(GameEvent.PLAYER_CLIMB_END);
  }
  
  private isInClimbeableArea(): boolean {
    // Check config-based climbeable
    if (this.config) {
      const distance = Math.abs(this.player.x - this.config.x);
      const verticalRange =
        this.player.y >= this.config.topY - CLIMB_TOP_BOUNDARY_OFFSET &&
        this.player.y <= this.config.bottomY + CLIMB_BOTTOM_BOUNDARY_OFFSET;
      
      if (distance <= this.config.width / 2 && verticalRange) {
        return true;
      }
    }
    
    // Check map-based climbeable areas
    if (this.climbeableGroup) {
      const playerBody = this.player.body;
      
      for (const climbeableRect of this.climbeableGroup.children.entries) {
        const climbeableBody = climbeableRect.body as Phaser.Physics.Arcade.StaticBody;
        
        if (this.scene.physics.world.overlap(playerBody, climbeableBody)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Public API
  public isPlayerOnClimbeable(): boolean {
    return this.isInClimbeableArea();
  }
  
  public canGrabClimbeable(): boolean {
    return this.isInClimbeableArea() && !this.player.isClimbing;
  }
  
  public forceExitClimbing(): void {
    this.exitClimbing();
  }
}