import type { System, InputState } from '../../shared/types';
import { Player } from './Player';

export class InputSystem implements System {
  private player: Player;
  private inputState: InputState;
  private previousInputState: InputState;
  
  constructor(player: Player) {
    this.player = player;
    
    // Initialize input state
    this.inputState = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      attack: false,
    };
    
    this.previousInputState = { ...this.inputState };
  }
  
  update(_time: number, _delta: number): void {
    // Store previous state for edge detection
    this.previousInputState = { ...this.inputState };
    
    // Get current input
    const cursors = this.player.getCursors();
    const keys = this.player.getKeys();
    
    // Update input state
    this.inputState = {
      left: cursors.left.isDown,
      right: cursors.right.isDown,
      up: cursors.up.isDown,
      down: cursors.down.isDown,
      jump: cursors.space?.isDown || false,
      attack: keys.z.isDown,
    };
    
    // Update facing direction based on input (unless climbing)
    if (!this.player.isClimbing) {
      if (this.inputState.left) {
        this.player.facingDirection = -1;
      } else if (this.inputState.right) {
        this.player.facingDirection = 1;
      }
    }
  }
  
  // Input state accessors
  public getInputState(): Readonly<InputState> {
    return { ...this.inputState };
  }
  
  public getPreviousInputState(): Readonly<InputState> {
    return { ...this.previousInputState };
  }
  
  // Convenience methods for edge detection
  public isJustPressed(input: keyof InputState): boolean {
    return this.inputState[input] && !this.previousInputState[input];
  }
  
  public isJustReleased(input: keyof InputState): boolean {
    return !this.inputState[input] && this.previousInputState[input];
  }
  
  public isPressed(input: keyof InputState): boolean {
    return this.inputState[input];
  }
  
  // Special input checks
  public isDoubleJumpPressed(): boolean {
    const keys = this.player.getKeys();
    return Phaser.Input.Keyboard.JustDown(keys.c);
  }
  
  public isMovingHorizontally(): boolean {
    return this.inputState.left || this.inputState.right;
  }
  
  public getHorizontalDirection(): -1 | 0 | 1 {
    if (this.inputState.left && !this.inputState.right) return -1;
    if (this.inputState.right && !this.inputState.left) return 1;
    return 0;
  }
  
  public isClimbInputActive(): boolean {
    return this.inputState.up || this.inputState.down;
  }
  
  public getClimbDirection(): -1 | 0 | 1 {
    if (this.inputState.up && !this.inputState.down) return 1;
    if (this.inputState.down && !this.inputState.up) return -1;
    return 0;
  }
}