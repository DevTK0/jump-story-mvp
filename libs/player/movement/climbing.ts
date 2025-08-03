import Phaser from 'phaser';
import type { System } from '../../core/types';
import { onSceneEvent } from '../../core/scene';
import { Player } from '../player';
import { InputSystem } from '../input';
import { MovementSystem } from './movement';
import { PLAYER_CONFIG } from '../config';
import type { IDebuggable } from '@/debug/debug-interfaces';
import { DEBUG_CONFIG } from '@/debug/config';
import { BaseDebugRenderer } from '@/debug/debug-renderer';

// Utility functions for climbing calculations
function getPlayerCenterX(player: Player): number {
  if (!player.body) {
    throw new Error('Player body is not initialized');
  }
  return player.body.x + player.body.width / 2;
}

function getClimbeableCenterX(area: Phaser.Physics.Arcade.StaticBody): number {
  return area.x + area.width / 2;
}

function isValidStaticBody(body: any): body is Phaser.Physics.Arcade.StaticBody {
  return (
    body &&
    typeof body.x === 'number' &&
    typeof body.y === 'number' &&
    typeof body.width === 'number' &&
    typeof body.height === 'number'
  );
}

// Physics management for climbing behavior
class ClimbingPhysics {
  private player: Player;
  private scene: Phaser.Scene;
  private originalGravity = 0;

  constructor(player: Player, scene: Phaser.Scene) {
    this.player = player;
    this.scene = scene;
    if (!player.body) {
      throw new Error('Player body must be initialized before creating ClimbingPhysics');
    }
    this.originalGravity = player.body.gravity.y;
  }

  public enableClimbingPhysics(): void {
    if (!this.player.body) {
      throw new Error('Player body is not initialized');
    }

    const body = this.player.body;
    // Only update originalGravity if it hasn't been set yet (avoid overwriting during climbing)
    if (this.originalGravity === 0 || !this.player.isClimbing) {
      this.originalGravity = body.gravity.y;
    }
    body.setGravityY(0);
    body.setVelocity(0, 0);
  }

  public disableClimbingPhysics(): void {
    if (!this.player.body) {
      throw new Error('Player body is not initialized');
    }

    const body = this.player.body;
    body.setGravityY(this.originalGravity);
    body.setVelocity(0, 0);
  }

  public handleClimbingGravity(isClimbing: boolean, isOnGround: boolean): void {
    if (!this.player.body) {
      throw new Error('Player body is not initialized');
    }

    const body = this.player.body;

    if (isClimbing && !isOnGround) {
      body.setGravityY(0);

      const worldGravity = this.scene.physics.world.gravity.y;
      if (worldGravity > 0) {
        body.setAcceleration(body.acceleration.x, -worldGravity);
      }
    } else {
      body.setGravityY(this.originalGravity);
      body.setAcceleration(body.acceleration.x, 0);
    }
  }

  public applyClimbingMovement(targetVelocityX: number, targetVelocityY: number): void {
    if (!this.player.body) {
      throw new Error('Player body is not initialized');
    }
    this.player.body.setVelocity(targetVelocityX, targetVelocityY);
  }

  public calculateSnapVelocity(currentClimbeableArea: Phaser.Physics.Arcade.StaticBody): {
    velocityX: number;
    isSnapping: boolean;
  } {
    const playerCenterX = getPlayerCenterX(this.player);
    const climbeableCenterX = getClimbeableCenterX(currentClimbeableArea);
    const distanceFromCenter = climbeableCenterX - playerCenterX;

    if (Math.abs(distanceFromCenter) > PLAYER_CONFIG.climbing.alignmentTolerance) {
      let velocityX = Math.sign(distanceFromCenter) * PLAYER_CONFIG.climbing.snapSpeed;

      if (Math.abs(velocityX) > Math.abs(distanceFromCenter * PLAYER_CONFIG.climbing.snapFps)) {
        velocityX = distanceFromCenter * PLAYER_CONFIG.climbing.snapFps;
      }

      return { velocityX, isSnapping: true };
    }

    return { velocityX: 0, isSnapping: false };
  }
}

// Collision detection and area management for climbing
class ClimbingCollision {
  private scene: Phaser.Scene;
  private player: Player;
  private climbeableGroup: Phaser.Physics.Arcade.Group | null = null;
  private currentClimbeableArea: Phaser.Physics.Arcade.StaticBody | null = null;
  private isInClimbeableArea = false;

  constructor(player: Player, scene: Phaser.Scene) {
    this.player = player;
    this.scene = scene;
  }

  public setClimbeableGroup(group: Phaser.Physics.Arcade.Group): void {
    this.climbeableGroup = group;
    this.setupOverlapDetection();
  }

  public updateCollision(): void {
    this.checkOverlap();
  }

  public isPlayerInClimbeableArea(): boolean {
    return this.isInClimbeableArea;
  }

  public getCurrentClimbeableArea(): Phaser.Physics.Arcade.StaticBody | null {
    return this.currentClimbeableArea;
  }

  public isPlayerNearCenter(): boolean {
    if (!this.currentClimbeableArea) return false;

    const playerCenterX = getPlayerCenterX(this.player);
    const climbeableCenterX = getClimbeableCenterX(this.currentClimbeableArea);
    const distanceFromCenter = Math.abs(playerCenterX - climbeableCenterX);
    const maxAllowedDistance =
      (this.currentClimbeableArea.width / 2) * PLAYER_CONFIG.climbing.centerThreshold;

    return distanceFromCenter <= maxAllowedDistance;
  }

  private setupOverlapDetection(): void {
    if (!this.climbeableGroup) return;

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

  private checkOverlap(): void {
    if (!this.climbeableGroup) {
      this.isInClimbeableArea = false;
      this.currentClimbeableArea = null;
      return;
    }

    if (!this.player.body) {
      throw new Error('Player body is not initialized');
    }

    const playerBody = this.player.body;
    this.isInClimbeableArea = false;
    this.currentClimbeableArea = null;

    for (const climbeableRect of this.climbeableGroup.children.entries) {
      const climbeableBody = climbeableRect.body;

      if (
        isValidStaticBody(climbeableBody) &&
        playerBody.x < climbeableBody.x + climbeableBody.width &&
        playerBody.x + playerBody.width > climbeableBody.x &&
        playerBody.y < climbeableBody.y + climbeableBody.height &&
        playerBody.y + playerBody.height > climbeableBody.y
      ) {
        this.isInClimbeableArea = true;
        this.currentClimbeableArea = climbeableBody;
        break;
      }
    }
  }

  public getClimbeableGroup(): Phaser.Physics.Arcade.Group | null {
    return this.climbeableGroup;
  }

  public checkClimbableBelow(distance: number = 10): Phaser.Physics.Arcade.StaticBody | null {
    if (!this.player.body || !this.climbeableGroup) return null;

    const playerBody = this.player.body;
    const playerBottom = playerBody.y + playerBody.height;
    const playerCenterX = playerBody.x + playerBody.width / 2;

    for (const climbeable of this.climbeableGroup.children.entries) {
      const body = climbeable.body;
      if (isValidStaticBody(body)) {
        // Check if climbable is below player (within distance pixels)
        // Also check if the top of the climbable extends above the player bottom
        // This handles cases where the ladder starts at or slightly above the platform
        const isBelow = body.y <= playerBottom + distance && body.y + body.height > playerBottom;

        // Check horizontal alignment with center threshold
        const climbeableCenterX = getClimbeableCenterX(body);
        const maxAllowedDistance = (body.width / 2) * PLAYER_CONFIG.climbing.centerThreshold;
        const isAligned = Math.abs(playerCenterX - climbeableCenterX) <= maxAllowedDistance;

        if (isBelow && isAligned) {
          return body;
        }
      }
    }
    return null;
  }

  public setTemporaryClimbableArea(area: Phaser.Physics.Arcade.StaticBody): void {
    this.currentClimbeableArea = area;
    this.isInClimbeableArea = true;
  }
}

export class ClimbingSystem extends BaseDebugRenderer implements System, IDebuggable {
  private player: Player;
  private inputSystem: InputSystem;
  private movementSystem: MovementSystem;
  private scene: Phaser.Scene;

  // Component classes
  private physics: ClimbingPhysics;
  private collision: ClimbingCollision;

  // State
  private isSnappingToCenter = false;
  private climbingDisabled = false; // For damaged state

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

    // Initialize component classes
    this.physics = new ClimbingPhysics(player, scene);
    this.collision = new ClimbingCollision(player, scene);

    // Listen for player death event
    onSceneEvent(scene, 'player:died', () => {
      if (this.player.isClimbing) {
        this.exitClimbing();
      }
      this.climbingDisabled = true;
    });
  }

  // Set up climbeable areas from tilemap
  public setClimbeableGroup(group: Phaser.Physics.Arcade.Group): void {
    this.collision.setClimbeableGroup(group);
  }

  update(_time: number, _delta: number): void {
    // Don't allow climbing if player is dead
    if (!this.player.isAlive) {
      if (this.player.isClimbing) {
        this.exitClimbing();
      }
      return;
    }

    // Re-enable climbing when player is alive (after respawn)
    if (this.player.isAlive && this.climbingDisabled) {
      this.climbingDisabled = false;
    }

    // Update collision detection
    this.collision.updateCollision();

    // Handle physics based on climbing state
    const isOnGround = this.movementSystem.isOnGround();
    this.physics.handleClimbingGravity(this.player.isClimbing, isOnGround);

    if (this.player.isClimbing) {
      this.updateClimbingMovement();
      this.checkClimbingExit();
    } else {
      this.checkClimbingStart();
    }
  }

  private get isPlayerUnableToClimb(): boolean {
    // Don't start climbing if disabled (e.g., during damaged state) or if dead
    return this.climbingDisabled || !this.player.isAlive;
  }

  private checkClimbingStart(): void {
    if (this.isPlayerUnableToClimb) {
      return;
    }

    const inputState = this.inputSystem.getInputState();
    const onGround = this.movementSystem.isOnGround();

    // Special case: climb down from platform edge - check this FIRST
    if (inputState.down && onGround) {
      // Check for climbable below with a larger distance to account for platform thickness
      const climbableBelow = this.collision.checkClimbableBelow(20); // Increased from 10 to 20
      if (climbableBelow) {
        // Set the climbable area and start climbing
        this.collision.setTemporaryClimbableArea(climbableBelow);
        this.startClimbing();
        // Move player down enough to clear the platform and enter the ladder
        if (this.player.body) {
          this.player.y += 10; // Increased from 5 to 10
          // Also ensure we're centered on the ladder
          const climbeableCenterX = getClimbeableCenterX(climbableBelow);
          this.player.x = climbeableCenterX - this.player.body.width / 2;
        }
        return;
      }
    }

    // Regular climbing start (overlapping with climbable area)
    if (this.collision.isPlayerInClimbeableArea() && this.collision.isPlayerNearCenter()) {
      if (inputState.up || inputState.down) {
        this.startClimbing();
      }
      return;
    }
  }

  private updateClimbingMovement(): void {
    if (!this.player.isClimbing) return;

    // If player is suddenly unable to climb while 
    if (this.isPlayerUnableToClimb) {
      this.forceExitClimbing();
      return;
    }

    const currentArea = this.collision.getCurrentClimbeableArea();
    if (!currentArea) {
      this.exitClimbing();
      return;
    }

    // Calculate snapping velocity and handle horizontal alignment
    const snapResult = this.physics.calculateSnapVelocity(currentArea);
    this.isSnappingToCenter = snapResult.isSnapping;

    // Calculate vertical movement based on input
    const verticalVelocity = this.calculateVerticalMovement();

    // Apply movement
    this.physics.applyClimbingMovement(snapResult.velocityX, verticalVelocity);

    // Exit if no longer in climbeable area
    if (!this.collision.isPlayerInClimbeableArea()) {
      this.exitClimbing();
    }
  }

  private calculateVerticalMovement(): number {
    // Only allow vertical movement if not actively snapping horizontally
    if (this.isSnappingToCenter) return 0;

    const inputState = this.inputSystem.getInputState();

    if (inputState.up) return -PLAYER_CONFIG.climbing.speed;
    if (inputState.down) return PLAYER_CONFIG.climbing.speed;

    return 0;
  }

  private checkClimbingExit(): void {
    const inputState = this.inputSystem.getInputState();
    const onGround = this.movementSystem.isOnGround();

    // Exit climbing with horizontal movement when on ground
    if (onGround && (inputState.left || inputState.right)) {
      this.exitClimbing();
      return;
    }

    // Jump off climbeable surface
    if (inputState.jump) {
      this.handleJumpExit();
    }
  }

  private handleJumpExit(): void {
    const horizontalDir = this.inputSystem.getHorizontalDirection();

    this.forceExitClimbing();

    // Apply jump
    this.movementSystem.forceJump();

    // Apply horizontal velocity if moving
    if (horizontalDir !== 0) {
      this.movementSystem.setVelocity(horizontalDir * this.player.getSpeed());
      this.player.facingDirection = horizontalDir as 1 | -1;
    }
  }

  private startClimbing(): void {
    this.player.setPlayerState({ isClimbing: true });
    this.physics.enableClimbingPhysics();

  }

  // Forced forces the checks to skip and forcefully exits
  private exitClimbing(forced?: boolean): void {
    if (!this.player.isClimbing && !forced) return;

    this.player.setPlayerState({ isClimbing: false });
    this.physics.disableClimbingPhysics();

  }

  // Public API
  public isPlayerOnClimbeable(): boolean {
    return this.collision.isPlayerInClimbeableArea();
  }

  public canGrabClimbeable(): boolean {
    return this.collision.isPlayerInClimbeableArea() && !this.player.isClimbing;
  }

  public forceExitClimbing(): void {
    this.exitClimbing(true);
  }

  public setClimbingDisabled(disabled: boolean): void {
    this.climbingDisabled = disabled;
    // If we're disabling climbing and currently climbing, exit climbing
    if (disabled && this.player.isClimbing) {
      this.exitClimbing();
    }
  }

  // Debug rendering implementation
  protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
    // Draw climbeable areas
    const climbeableGroup = this.collision.getClimbeableGroup();
    if (climbeableGroup) {
      graphics.lineStyle(2, DEBUG_CONFIG.colors.climbeable, 0.8);
      graphics.fillStyle(DEBUG_CONFIG.colors.climbeable, 0.2);

      climbeableGroup.children.entries.forEach((climbeable) => {
        const body = climbeable.body;
        if (isValidStaticBody(body)) {
          graphics.fillRect(body.x, body.y, body.width, body.height);
          graphics.strokeRect(body.x, body.y, body.width, body.height);
        }
      });
    }
  }

  protected provideDebugInfo(): Record<string, any> {
    const climbeableGroup = this.collision.getClimbeableGroup();

    return {
      'climb.climbing': this.player.isClimbing,
      'climb.inArea': this.collision.isPlayerInClimbeableArea(),
      'climb.nearCenter': this.collision.isPlayerNearCenter(),
      'climb.snapping': this.isSnappingToCenter,
      'climb.bodyGravity': this.player.body.gravity.y,
      'climb.worldGravity': this.scene.physics.world.gravity.y,
      'climb.velocityY': Math.round(this.player.body.velocity.y),
      'climb.velocityX': Math.round(this.player.body.velocity.x),
      'climb.accelY': Math.round(this.player.body.acceleration.y),
      'climb.accelX': Math.round(this.player.body.acceleration.x),
      'climb.areas': climbeableGroup?.children.entries.length || 0,
    };
  }
}
