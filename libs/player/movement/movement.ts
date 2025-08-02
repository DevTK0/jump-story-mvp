import type { System } from '../../core/types';
import { Player } from '../player';
import { InputSystem } from '../input';
import type { IDebuggable } from '@/debug/debug-interfaces';
import { ShadowState } from '@/debug/debug-state';
import { DEBUG_CONFIG } from '@/debug/config';
import { BaseDebugRenderer } from '@/debug/debug-renderer';
import { ShadowTrajectoryRenderer } from '@/effects/shadow';
import { FacingDirection } from '@/spacetime/client';
import { createLogger } from '@/core/logger';
import { stateValidator } from '@/core/state-validator';
import { MovementStateTracker } from './movement-state-tracker';
import { emitSceneEvent } from '@/core/scene/scene-events';

export class MovementSystem extends BaseDebugRenderer implements System, IDebuggable {
  private player: Player;
  private inputSystem: InputSystem;
  private logger = createLogger('MovementSystem');

  // Movement state tracking
  private stateTracker: MovementStateTracker;

  // Shadow trajectory renderer
  private shadowRenderer: ShadowTrajectoryRenderer;

  private _acceleration: number = 10;

  constructor(player: Player, inputSystem: InputSystem) {
    super();
    this.player = player;
    this.inputSystem = inputSystem;
    this.shadowRenderer = new ShadowTrajectoryRenderer(player.scene);
    this.stateTracker = new MovementStateTracker(player.body?.onFloor() || false);
  }

  update(time: number, _delta: number): void {
    // Check if player is dead
    const isPlayerDead = stateValidator.isCurrentPlayerDead();
    if (isPlayerDead) {
      // When dead, only stop horizontal movement but let gravity work
      this.player.body.setVelocityX(0);
      // Don't process any input or other movement logic
      return;
    }

    if (this.player.isClimbing && this.stateTracker.getHasUsedDoubleJump()) {
      this.stateTracker.resetDoubleJumpOnLanding();
      logger.info('[MovementSystem] Update resetDoubleJump while climbing', this.stateTracker.getHasUsedDoubleJump());
    }

    // Handle movement physics (skip if climbing, dashing, casting, or movement disabled)
    const isCasting = this.player.currentAttackType === 'casting';
    if (!this.player.isDashing && !isCasting && !this.stateTracker.isMovementDisabled()) {
      const body = this.player.body;
      const onGround = body.onFloor();

      // Check for ground contact transition (landing)
      if (this.stateTracker.hasLanded(onGround)) {
        this.logger.debug('Player landed - forcing position sync');
        this.stateTracker.resetDoubleJumpOnLanding();
      }

      // Update facing direction based on input (works both on ground and in air)
      const horizontalDir = this.inputSystem.getHorizontalDirection();
      this.stateTracker.updateFacingFromInput(horizontalDir);

      // Horizontal movement (only when on ground)
      body.setMaxVelocityX(this.player.getSpeed());
      if (onGround) {
        body.setAccelerationX(0);
        if (horizontalDir !== 0) {
          body.setVelocityX(horizontalDir * this.player.getSpeed());

          // Transition to walk state if not already walking or attacking
          if (!this.player.isInState('Walk') && !this.player.isAttacking) {
            this.player.transitionToState('Walk');
          }
        } else {
          body.setVelocityX(0);
          // Transition to idle state if not already idle or attacking
          if (!this.player.isInState('Idle') && !this.player.isAttacking) {
            this.player.transitionToState('Idle');
          }
        }
      } else {
        body.setAccelerationX(this._acceleration * horizontalDir * this.player.getSpeed());
      }

      // Regular jump
      if (this.inputSystem.isJumpPressed()) {
        if (onGround) {
          this.jump();
          this.player.transitionToState('Jump');
          this.logger.debug('Player jumped');
        } else {
          // Double jump
          this.handleDoubleJump();
        }
      }


      // Sliding on wall
      const onWall = body.onWall();
      if (onWall) {
        body.setVelocityX(horizontalDir * 10);
      }
    }

    // Sample trajectory only if shadow effect is explicitly enabled
    const shouldShowShadow = ShadowState.getInstance().enabled;
    if (shouldShowShadow) {
      this.shadowRenderer.sampleTrajectory(
        time,
        this.player.x,
        this.player.y,
        this.player.texture.key,
        this.player.frame.name,
        this.player.flipX,
        this.player.scaleX,
        this.player.scaleY
      );
    } else if (this.shadowRenderer.getTrajectoryPointCount() > 0) {
      // Clear trajectory when shadow is disabled
      this.shadowRenderer.clearTrajectory();
      this.shadowRenderer.cleanupSprites();
    }
  }

  private jump(): void {
    this.player.body.setVelocityY(-this.player.getJumpSpeed());
    
    // Emit jump event for audio system
    emitSceneEvent(this.player.scene, 'player:jumped', {
      position: { x: this.player.x, y: this.player.y }
    });
  }

  private handleDoubleJump(): void {
    const onGround = this.player.body.onFloor();

    logger.info('[handleDoubleJump]', { hasUsedDoubleJump: this.stateTracker.getHasUsedDoubleJump(), isClimbing: this.player.isClimbing });

    // Check for double jump input
    if (
      // this.inputSystem.isDoubleJumpPressed() &&
      !onGround &&
      !this.stateTracker.getHasUsedDoubleJump() &&
      !this.player.isClimbing &&
      (this.player.jobConfig?.baseStats?.doubleJump ?? false)
    ) {
      this.player.body.setVelocityY(-this.player.getJumpSpeed());
      this.stateTracker.setHasUsedDoubleJump(true);
      
      // Emit jump event for audio system (double jump)
      emitSceneEvent(this.player.scene, 'player:jumped', {
        position: { x: this.player.x, y: this.player.y }
      });
    }

    // Reset double jump when landing
    if (onGround && this.stateTracker.getHasUsedDoubleJump()) {
      this.stateTracker.setHasUsedDoubleJump(false);
    }
  }

  // Public methods for other systems to use
  public forceJump(velocityMultiplier: number = 1): void {
    this.player.body.setVelocityY(-this.player.getJumpSpeed() * velocityMultiplier);
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
    this.stateTracker.setHasUsedDoubleJump(false);
  }

  public getCurrentFacing(): FacingDirection {
    return this.stateTracker.getCurrentFacing();
  }

  public setMovementDisabled(disabled: boolean): void {
    this.stateTracker.setMovementDisabled(disabled);
  }

  public getMovementStateSnapshot() {
    return this.stateTracker.getStateSnapshot();
  }

  // Debug resource cleanup implementation
  cleanupDebugResources(): void {
    this.shadowRenderer.cleanupSprites();
  }

  protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
    const body = this.player.body;
    if (!body) return;

    // Draw velocity vector (only in debug mode)
    this.drawVelocityVector(graphics, body);
  }

  /**
   * Render shadow effect separately from debug mode
   * This allows shadow to be shown independently
   */
  public renderShadowEffect(): void {
    if (ShadowState.getInstance().enabled) {
      this.shadowRenderer.render();
    }
  }

  private drawVelocityVector(
    graphics: Phaser.GameObjects.Graphics,
    body: Phaser.Physics.Arcade.Body
  ): void {
    const velX = body.velocity.x;
    const velY = body.velocity.y;

    // Only draw if there's some velocity
    if (Math.abs(velX) < 0.1 && Math.abs(velY) < 0.1) return;

    const endX = this.player.x + velX * DEBUG_CONFIG.ui.velocityScale;
    const endY = this.player.y + velY * DEBUG_CONFIG.ui.velocityScale;

    graphics.lineStyle(3, DEBUG_CONFIG.colors.velocity, 0.2);
    graphics.lineBetween(this.player.x, this.player.y, endX, endY);

    // Draw velocity arrow head
    const angle = Math.atan2(velY, velX);
    const arrowLength = DEBUG_CONFIG.ui.arrowLength;
    const arrowAngle = DEBUG_CONFIG.ui.arrowAngle;

    graphics.lineBetween(
      endX,
      endY,
      endX - arrowLength * Math.cos(angle - arrowAngle),
      endY - arrowLength * Math.sin(angle - arrowAngle)
    );

    graphics.lineBetween(
      endX,
      endY,
      endX - arrowLength * Math.cos(angle + arrowAngle),
      endY - arrowLength * Math.sin(angle + arrowAngle)
    );
  }

  protected provideDebugInfo(): Record<string, any> {
    const body = this.player.body;
    return {
      velocity: {
        x: Math.round(body.velocity.x),
        y: Math.round(body.velocity.y),
      },
      onGround: body.onFloor(),
      hasUsedDoubleJump: this.stateTracker.getHasUsedDoubleJump(),
      trajectoryPoints: this.shadowRenderer.getTrajectoryPointCount(),
    };
  }

  // Clean up all resources

  destroy(): void {
    this.shadowRenderer.destroy();
  }
}
