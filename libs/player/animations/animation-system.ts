import Phaser from 'phaser';
import type { System } from '../../core/types';
import { onSceneEvent } from '../../core/scene';
import { Player } from '../player';
import { InputSystem } from '../input';
import { AnimationFactory } from '@/core/animations';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { PlayerAnimationManager } from './player-animation-manager';
import { PLAYER_ANIMATION_TIMINGS } from './config';
import { getAttackAnimationDuration } from './animation-duration-helper';

export class AnimationSystem implements System {
  private player: Player;
  private scene: Phaser.Scene;
  private logger: ModuleLogger = createLogger('AnimationSystem');

  // Animation manager
  private animationManager: PlayerAnimationManager;

  // State tracking
  private isPlayingAttackAnimation = false;
  private isPlayingDamagedAnimation = false;
  private isInvulnerable = false;
  private invulnerabilityTimer: number | null = null;

  constructor(player: Player, _inputSystem: InputSystem, scene: Phaser.Scene) {
    this.player = player;
    this.scene = scene;

    // Initialize animation manager
    this.animationManager = new PlayerAnimationManager(scene, player);

    this.verifyAnimations();
    this.bindEvents();
  }

  private verifyAnimations(): void {
    // Verify that player animations exist (created at scene level)
    const spriteKey = this.player.texture.key;
    const idleAnimKey = AnimationFactory.getAnimationKey(spriteKey, 'idle');
    if (!this.scene.anims.exists(idleAnimKey)) {
      this.logger.warn(
        `Player animations not found for sprite '${spriteKey}'! They should be created at scene level.`
      );
    }
  }

  private bindEvents(): void {
    // Listen for combat events to handle attack animations
    onSceneEvent(this.scene, 'player:attacked', async (data) => {
      this.isPlayingAttackAnimation = true;

      // Play the appropriate attack animation based on attack type
      const attackType = data.attackType || 1;
      const animationType = `attack${attackType}` as any;
      this.animationManager.play(animationType, false);

      try {
        // Use actual sprite animation duration
        const jobKey = this.player.texture.key;
        const attackDuration = getAttackAnimationDuration(jobKey, attackType);
        await this.delay(attackDuration);
        this.isPlayingAttackAnimation = false;
      } catch (error) {
        console.warn('Attack animation interrupted:', error);
        this.isPlayingAttackAnimation = false;
      }
    });
  }

  update(_time: number, _delta: number): void {
    // Check if player is dead
    const stateMachine = this.player.getStateMachine();
    if (stateMachine.isInState('Dead')) {
      // Play death animation once and stop on last frame
      const currentKey = this.animationManager.getCurrentAnimation();
      const spriteKey = this.player.texture.key;
      const deathAnimKey = AnimationFactory.getAnimationKey(spriteKey, 'death');

      if (currentKey !== deathAnimKey) {
        // Play death animation once
        this.animationManager.play('death', false);
        // Stop on the last frame when animation completes
        this.player.once('animationcomplete', (animation: any) => {
          if (animation.key === deathAnimKey) {
            this.player.anims.stop();
            // Get the last frame from the animation itself
            const anim = this.scene.anims.get(deathAnimKey);
            if (anim && anim.frames.length > 0) {
              const lastFrame = anim.frames[anim.frames.length - 1].frame;
              this.player.setFrame(lastFrame);
            }
          }
        });
      }
      return;
    }

    // Don't change animations during attack or damaged
    if (this.isPlayingAttackAnimation || this.isPlayingDamagedAnimation) {
      return;
    }

    // Determine appropriate animation based on state
    const targetAnimationType = this.determineAnimationType();

    // Only change if different from current
    const currentKey = this.animationManager.getCurrentAnimation();
    // Use the current texture key instead of hardcoded 'soldier'
    const spriteKey = this.player.texture.key;
    const targetKey = AnimationFactory.getAnimationKey(spriteKey, targetAnimationType);
    if (targetKey !== currentKey) {
      this.animationManager.play(targetAnimationType);
    }
  }

  private determineAnimationType(): 'idle' | 'walk' {
    const body = this.player.body;

    // Climbing animations (if we have them)
    if (this.player.isClimbing) {
      // For now, use idle while climbing
      return 'idle';
    }

    // Ground-based animations
    if (Math.abs(body.velocity.x) > 0.1) {
      return 'walk';
    } else {
      return 'idle';
    }
  }

  // Public API removed createCustomAnimation - animations should be created at scene level

  public stopAnimation(): void {
    this.animationManager.stop();
  }

  public pauseAnimation(): void {
    this.player.anims.pause();
  }

  public resumeAnimation(): void {
    this.player.anims.resume();
  }

  public isAnimationPlaying(animationKey?: string): boolean {
    if (animationKey) {
      return this.player.anims.isPlaying && this.player.anims.currentAnim?.key === animationKey;
    }
    return this.player.anims.isPlaying;
  }

  public getCurrentAnimation(): string | null {
    return this.animationManager.getCurrentAnimation();
  }

  public hasAnimation(key: string): boolean {
    return this.scene.anims.exists(key);
  }

  public playDamagedAnimation(knockbackDirection?: { x: number; y: number }): boolean {
    // Don't play damaged animation if already invulnerable
    if (this.isInvulnerable) {
      return false;
    }

    this.isPlayingDamagedAnimation = true;
    this.isInvulnerable = true;

    // Transition state machine to Damaged state
    const stateMachine = this.player.getStateMachine();
    if (stateMachine) {
      stateMachine.transitionTo('Damaged');
    }

    // Disable movement input during damaged state
    const movementSystem = this.player.getSystem('movement') as any;
    if (movementSystem && movementSystem.setMovementDisabled) {
      movementSystem.setMovementDisabled(true);
    }

    // Disable climbing input and exit climbing if currently climbing
    const climbingSystem = this.player.getSystem('climbing') as any;
    if (climbingSystem) {
      if (climbingSystem.setClimbingDisabled) {
        climbingSystem.setClimbingDisabled(true);
      }
      // exitClimbing is automatically called by setClimbingDisabled if currently climbing
    }

    // Check if player's job is immune to knockback
    const combatSystem = this.player.getSystem('combat') as any;
    const isKnockbackImmune = combatSystem?.getJobConfig?.()?.baseStats?.knockbackImmune || false;

    // Apply knockback if direction provided (but not during dash attacks or if immune)
    if (knockbackDirection && this.player.body && !this.player.isDashing && !isKnockbackImmune) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const knockbackForce = PLAYER_ANIMATION_TIMINGS.KNOCKBACK.FORCE;

      // For ground-based knockback, prioritize horizontal movement with small upward boost
      const isGroundKnockback =
        Math.abs(knockbackDirection.y) < PLAYER_ANIMATION_TIMINGS.KNOCKBACK.GROUND_THRESHOLD;

      if (isGroundKnockback) {
        // Ground knockback: moderate horizontal push + small upward boost
        body.setVelocity(
          knockbackDirection.x * knockbackForce,
          -PLAYER_ANIMATION_TIMINGS.KNOCKBACK.UPWARD_VELOCITY
        );
      } else {
        // Air knockback: use full direction
        body.setVelocity(
          knockbackDirection.x * knockbackForce,
          knockbackDirection.y * knockbackForce
        );
      }
    }

    // Add visual feedback during invulnerability (flashing effect)
    this.startInvulnerabilityFlash();

    this.animationManager.play('damaged', false);

    // Reset damaged animation flag and re-enable movement after animation completes
    this.handleDamagedAnimationComplete(movementSystem, climbingSystem);

    // End invulnerability after 1 second
    this.handleInvulnerabilityEnd();

    return true;
  }

  private startInvulnerabilityFlash(): void {
    let flashCount = 0;
    const maxFlashes = PLAYER_ANIMATION_TIMINGS.MAX_FLASHES;

    const flashInterval = setInterval(() => {
      if (flashCount >= maxFlashes || !this.isInvulnerable) {
        clearInterval(flashInterval);
        // Ensure player is fully visible when flashing ends
        this.player.clearTint();
        this.player.setAlpha(1);
        return;
      }

      // Alternate between normal and transparent
      if (flashCount % 2 === 0) {
        this.player.setTint(0xffffff); // Normal
        this.player.setAlpha(0.5); // Semi-transparent
      } else {
        this.player.clearTint(); // Remove tint
        this.player.setAlpha(1); // Fully visible
      }

      flashCount++;
    }, PLAYER_ANIMATION_TIMINGS.FLASH_INTERVAL);
  }

  public isPlayerInvulnerable(): boolean {
    return this.isInvulnerable;
  }

  /**
   * Reset player visual state (useful for fixing transparency bugs)
   */
  public resetPlayerVisualState(): void {
    this.player.clearTint();
    this.player.setAlpha(1);
    this.isInvulnerable = false;
    this.isPlayingDamagedAnimation = false;
  }

  /**
   * Promise-based delay utility for async animation patterns
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Handle damaged animation completion asynchronously
   */
  private async handleDamagedAnimationComplete(
    movementSystem: any,
    climbingSystem: any
  ): Promise<void> {
    try {
      await this.delay(PLAYER_ANIMATION_TIMINGS.DAMAGED_DURATION);

      this.isPlayingDamagedAnimation = false;
      // Re-enable movement after damaged animation
      if (movementSystem && movementSystem.setMovementDisabled) {
        movementSystem.setMovementDisabled(false);
      }
      // Re-enable climbing after damaged animation
      if (climbingSystem && climbingSystem.setClimbingDisabled) {
        climbingSystem.setClimbingDisabled(false);
      }
    } catch (error) {
      this.logger.warn('Damaged animation completion interrupted:', error);
      this.isPlayingDamagedAnimation = false;
    }
  }

  /**
   * Handle invulnerability end asynchronously
   */
  private async handleInvulnerabilityEnd(): Promise<void> {
    if (this.invulnerabilityTimer) {
      clearTimeout(this.invulnerabilityTimer);
    }

    try {
      await this.delay(PLAYER_ANIMATION_TIMINGS.INVULNERABILITY_DURATION);
      this.isInvulnerable = false;
      // Ensure player is fully visible and normal when invulnerability ends
      this.player.clearTint();
      this.player.setAlpha(1);
    } catch (error) {
      this.logger.warn('Invulnerability end interrupted:', error);
      this.isInvulnerable = false;
      // Ensure player is fully visible even if interrupted
      this.player.clearTint();
      this.player.setAlpha(1);
    }
  }

  destroy(): void {
    // Clean up timers
    if (this.invulnerabilityTimer) {
      clearTimeout(this.invulnerabilityTimer);
    }

    // Reset player visual state in case of cleanup during effects
    if (this.player && this.player.scene) {
      this.player.clearTint();
      this.player.setAlpha(1);
    }

    // Reset state flags
    this.isInvulnerable = false;
    this.isPlayingDamagedAnimation = false;

    // Scene events are automatically cleaned up when scene is destroyed
    // Animations remain in scene and are cleaned up when scene is destroyed
  }
}
