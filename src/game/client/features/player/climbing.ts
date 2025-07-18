import Phaser from 'phaser';
import type { System } from '../../shared/types';
import { gameEvents, GameEvent } from '../../shared/events';
import { Player } from './Player';
import { InputSystem } from './input';
import { MovementSystem } from './movement';
import { CLIMB_SPEED } from './constants';
import type { IDebuggable } from '../../shared/debug';
import { DEBUG_CONFIG, BaseDebugRenderer } from '../../shared/debug';


export class ClimbingSystem extends BaseDebugRenderer implements System, IDebuggable {
  private player: Player;
  private inputSystem: InputSystem;
  private movementSystem: MovementSystem;
  private scene: Phaser.Scene;
  
  // Climbeable areas from tilemap
  private climbeableGroup: Phaser.Physics.Arcade.Group | null = null;
  
  // State
  private originalGravity = 0;
  private isInClimbeableArea = false;
  
  constructor(
    player: Player,
    inputSystem: InputSystem,
    movementSystem: MovementSystem,
    scene: Phaser.Scene
  ) {
    super();
    this.player = player;
    this.inputSystem = inputSystem;
    this.movementSystem = movementSystem;
    this.scene = scene;
    this.originalGravity = this.player.body.gravity.y;
  }
  
  // Set up climbeable areas from tilemap
  public setClimbeableGroup(group: Phaser.Physics.Arcade.Group): void {
    this.climbeableGroup = group;
    this.setupClimbeableOverlaps();
  }
  
  
  update(_time: number, _delta: number): void {
    // Update climbeable area detection
    this.checkClimbeableOverlap();
    
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
    
    // Check for climbing initiation
    if (inputState.up && this.isInClimbeableArea) {
      this.startClimbing();
    }
    
    // Check for climbing descent from ground
    if (inputState.down && onGround && this.isInClimbeableArea) {
      this.startClimbing();
    }
  }
  
  private updateClimbing(): void {
    if (!this.player.isClimbing) return;
    
    const body = this.player.body;
    const inputState = this.inputSystem.getInputState();
    let targetVelocityY = 0;
    
    // Map-based climbing
    if (inputState.up) {
      targetVelocityY = -CLIMB_SPEED;
    } else if (inputState.down) {
      targetVelocityY = CLIMB_SPEED;
    }
    
    body.setVelocity(0, targetVelocityY);
    
    // Exit climbing if no longer in climbeable area
    if (!this.isInClimbeableArea) {
      this.exitClimbing();
    }
  }
  
  private handleClimbingExit(): void {
    const inputState = this.inputSystem.getInputState();
    
    // Jump off climbeable surface
    if (inputState.jump) {
      const horizontalDir = this.inputSystem.getHorizontalDirection();
      
      this.exitClimbing();
      
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
  
  private setupClimbeableOverlaps(): void {
    if (!this.climbeableGroup) return;
    
    // Set up overlap detection for climbeable areas
    this.scene.physics.add.overlap(
      this.player,
      this.climbeableGroup,
      () => {
        this.isInClimbeableArea = true;
      },
      undefined,
      this.scene
    );
  }

  private checkClimbeableOverlap(): void {
    if (!this.climbeableGroup) {
      this.isInClimbeableArea = false;
      return;
    }
    
    const playerBody = this.player.body;
    this.isInClimbeableArea = false;
    
    // Check if player is overlapping with any climbeable area
    for (const climbeableRect of this.climbeableGroup.children.entries) {
      const climbeableBody = climbeableRect.body as Phaser.Physics.Arcade.StaticBody;
      
      if (this.scene.physics.world.overlap(playerBody, climbeableBody)) {
        this.isInClimbeableArea = true;
        break;
      }
    }
  }
  
  // Public API
  public isPlayerOnClimbeable(): boolean {
    return this.isInClimbeableArea;
  }
  
  public canGrabClimbeable(): boolean {
    return this.isInClimbeableArea && !this.player.isClimbing;
  }
  
  public forceExitClimbing(): void {
    this.exitClimbing();
  }
  
  // Debug rendering implementation
  protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
    // Draw climbeable areas
    if (this.climbeableGroup) {
      graphics.lineStyle(2, DEBUG_CONFIG.colors.climbeable, 0.8);
      graphics.fillStyle(DEBUG_CONFIG.colors.climbeable, 0.2);
      
      this.climbeableGroup.children.entries.forEach(climbeable => {
        const body = climbeable.body as Phaser.Physics.Arcade.StaticBody;
        if (body) {
          graphics.fillRect(body.x, body.y, body.width, body.height);
          graphics.strokeRect(body.x, body.y, body.width, body.height);
        }
      });
    }
  }
  
  protected provideDebugInfo(): Record<string, any> {
    return {
      isClimbing: this.player.isClimbing,
      isInClimbeableArea: this.isInClimbeableArea,
      canGrabClimbeable: this.canGrabClimbeable(),
      climbeableCount: this.climbeableGroup?.children.entries.length || 0,
    };
  }
  
}