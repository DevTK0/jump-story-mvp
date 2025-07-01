import type { System } from '../../shared/types';
import { gameEvents, GameEvent } from '../../shared/events';
import { Player } from './Player';
import { InputSystem } from './input';

export class MovementSystem implements System {
  private player: Player;
  private inputSystem: InputSystem;
  
  // Movement state
  private hasUsedDoubleJump = false;
  
  constructor(player: Player, inputSystem: InputSystem) {
    this.player = player;
    this.inputSystem = inputSystem;
  }
  
  update(_time: number, _delta: number): void {
    // Don't move if climbing (handled by climbing system)
    if (this.player.isClimbing) {
      return;
    }
    
    const body = this.player.body;
    const onGround = body.onFloor();
    const inputState = this.inputSystem.getInputState();
    
    // Horizontal movement (only when on ground)
    if (onGround) {
      const horizontalDir = this.inputSystem.getHorizontalDirection();
      if (horizontalDir !== 0) {
        body.setVelocityX(horizontalDir * this.player.getSpeed());
      } else {
        body.setVelocityX(0);
      }
    }
    
    // Regular jump
    if (inputState.jump && onGround) {
      this.jump();
    }
    
    // Double jump
    this.handleDoubleJump();
  }
  
  private jump(): void {
    this.player.body.setVelocityY(-this.player.getJumpSpeed());
    gameEvents.emit(GameEvent.PLAYER_JUMP, { velocity: this.player.getJumpSpeed() });
  }
  
  private handleDoubleJump(): void {
    const onGround = this.player.body.onFloor();
    
    // Check for double jump input
    if (
      this.inputSystem.isDoubleJumpPressed() &&
      !onGround &&
      !this.hasUsedDoubleJump &&
      !this.player.isClimbing
    ) {
      this.player.body.setVelocityY(-this.player.getJumpSpeed());
      this.hasUsedDoubleJump = true;
      gameEvents.emit(GameEvent.PLAYER_JUMP, { velocity: this.player.getJumpSpeed() });
    }
    
    // Reset double jump when landing
    if (onGround && this.hasUsedDoubleJump) {
      this.hasUsedDoubleJump = false;
    }
  }
  
  // Public methods for other systems to use
  public forceJump(velocityMultiplier: number = 1): void {
    this.player.body.setVelocityY(-this.player.getJumpSpeed() * velocityMultiplier);
    gameEvents.emit(GameEvent.PLAYER_JUMP, { 
      velocity: this.player.getJumpSpeed() * velocityMultiplier 
    });
  }
  
  public setVelocity(x?: number, y?: number): void {
    if (x !== undefined) {
      this.player.body.setVelocityX(x);
    }
    if (y !== undefined) {
      this.player.body.setVelocityY(y);
    }
  }
  
  public stopMovement(): void {
    this.player.body.setVelocity(0, 0);
  }
  
  public isOnGround(): boolean {
    return this.player.body.onFloor();
  }
  
  public resetDoubleJump(): void {
    this.hasUsedDoubleJump = false;
  }
}