import { FacingDirection } from '@/spacetime/client';

/**
 * Tracks movement-related state for the player
 * Extracted from MovementSystem to follow single responsibility principle
 */
export class MovementStateTracker {
  private hasUsedDoubleJump = false;
  private wasOnGround = false;
  private currentFacing: FacingDirection = { tag: 'Right' };
  private movementDisabled = false;

  constructor(initialOnGround = false) {
    this.wasOnGround = initialOnGround;
  }

  // Double jump state management
  public getHasUsedDoubleJump(): boolean {
    return this.hasUsedDoubleJump;
  }

  public setHasUsedDoubleJump(used: boolean): void {
    this.hasUsedDoubleJump = used;
  }

  public resetDoubleJumpOnLanding(): void {
    this.hasUsedDoubleJump = false;
  }

  // Ground state management
  public getWasOnGround(): boolean {
    return this.wasOnGround;
  }

  public updateGroundState(currentlyOnGround: boolean): void {
    this.wasOnGround = currentlyOnGround;
  }

  public isOnGroundTransition(): boolean {
    // This would be called after updateGroundState with current ground status
    // The logic would need to be handled by the caller who knows both states
    return false; // Placeholder - caller should check this logic
  }

  public hasLanded(currentlyOnGround: boolean): boolean {
    const landed = currentlyOnGround && !this.wasOnGround;
    this.updateGroundState(currentlyOnGround);
    return landed;
  }

  // Facing direction management
  public getCurrentFacing(): FacingDirection {
    return this.currentFacing;
  }

  public setCurrentFacing(direction: FacingDirection): void {
    this.currentFacing = direction;
  }

  public updateFacingFromInput(horizontalDirection: number): void {
    if (horizontalDirection !== 0) {
      this.currentFacing = horizontalDirection < 0 ? { tag: 'Left' } : { tag: 'Right' };
    }
  }

  // Movement disability (for damaged state, knockback, etc.)
  public isMovementDisabled(): boolean {
    return this.movementDisabled;
  }

  public setMovementDisabled(disabled: boolean): void {
    this.movementDisabled = disabled;
  }

  public enableMovement(): void {
    this.movementDisabled = false;
  }

  public disableMovement(): void {
    this.movementDisabled = true;
  }

  // Reset all state (useful for respawn, teleport, etc.)
  public resetState(): void {
    this.hasUsedDoubleJump = false;
    this.wasOnGround = false;
    this.currentFacing = { tag: 'Right' };
    this.movementDisabled = false;
  }

  // Get a snapshot of all current state (useful for debugging)
  public getStateSnapshot(): MovementStateSnapshot {
    return {
      hasUsedDoubleJump: this.hasUsedDoubleJump,
      wasOnGround: this.wasOnGround,
      currentFacing: this.currentFacing,
      movementDisabled: this.movementDisabled,
    };
  }
}

export interface MovementStateSnapshot {
  hasUsedDoubleJump: boolean;
  wasOnGround: boolean;
  currentFacing: FacingDirection;
  movementDisabled: boolean;
}
