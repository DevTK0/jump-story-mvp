import Phaser from 'phaser';
import type { System } from '../core/types';
import { Player } from './player';
import { InputSystem } from './input';
import { gameEvents } from '../core/events';
import { PlayerEvent } from './player-events';
import { AnimationFactory, AnimationManager, ANIMATION_TIMINGS } from '../animations';

export class AnimationSystem implements System {
  private player: Player;

  // Animation factory and manager
  private animationFactory: AnimationFactory;
  private animationManager: AnimationManager;

  // State tracking
  private isPlayingAttackAnimation = false;
  private isPlayingDamagedAnimation = false;
  private isInvulnerable = false;
  private invulnerabilityTimer: number | null = null;

  constructor(player: Player, _inputSystem: InputSystem, scene: Phaser.Scene) {
    this.player = player;

    // Initialize animation factory and manager
    this.animationFactory = new AnimationFactory(scene);
    this.animationManager = new AnimationManager(this.animationFactory, player);

    this.setupAnimations();
    this.bindEvents();
  }

  private setupAnimations(): void {
    // Animations are now created at scene level, so we just verify they exist
    if (!this.animationFactory.hasAnimation('soldier-idle-anim')) {
      console.warn('Player animations not found! They should be created at scene level.');
    }
  }

  private bindEvents(): void {
    // Listen for combat events to handle attack animations
    gameEvents.on(PlayerEvent.PLAYER_ATTACKED, async (data: any) => {
      this.isPlayingAttackAnimation = true;

      // Play the appropriate attack animation based on attack type
      const attackType = data.attackType || 1;
      const animationType = `attack${attackType}` as any;
      this.animationManager.play(animationType, false);

      try {
        // Use timing from centralized definitions
        const attackDuration =
          ANIMATION_TIMINGS.ATTACK_DURATIONS[
            animationType as keyof typeof ANIMATION_TIMINGS.ATTACK_DURATIONS
          ] || ANIMATION_TIMINGS.DEFAULT_ATTACK_DURATION;
        await this.delay(attackDuration);
        this.isPlayingAttackAnimation = false;
      } catch (error) {
        console.warn('Attack animation interrupted:', error);
        this.isPlayingAttackAnimation = false;
      }
    });
  }

  update(_time: number, _delta: number): void {
    if (!this.player.isAlive) {
      return;
    }

    // Check if player is dead
    const stateMachine = this.player.getStateMachine();
    if (stateMachine.isInState('Dead')) {
      // Play death animation once and stop on last frame
      const currentKey = this.animationManager.getCurrentAnimation();
      const deathKey = this.animationFactory.getAnimationKey('soldier', 'death');
      if (currentKey !== deathKey) {
        // Play death animation once
        this.animationManager.play('death', false);
        // Stop on the last frame when animation completes
        this.player.once('animationcomplete', (animation: any) => {
          if (animation.key === deathKey) {
            this.player.anims.stop();
            // Set to last frame of death animation
            // The death animation frames are defined in sprite-config.json
            this.player.setFrame(ANIMATION_TIMINGS.SPRITE_FRAMES.SOLDIER_DEATH_LAST_FRAME);
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
    const targetKey = this.animationFactory.getAnimationKey('soldier', targetAnimationType);
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

  // Public API
  public createCustomAnimation(
    spriteKey: string,
    animationType: string,
    frames: { start: number; end: number },
    frameRate: number,
    repeat: number = -1
  ): void {
    this.animationFactory.createCustomAnimation(
      spriteKey,
      animationType,
      frames,
      frameRate,
      repeat
    );
  }

  public forcePlayAnimation(animationKey: string): void {
    this.animationManager.playByKey(animationKey, false);
  }

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
    return this.animationFactory.hasAnimation(key);
  }

  public playDamagedAnimation(knockbackDirection?: { x: number; y: number }): boolean {
    // Don't play damaged animation if already invulnerable
    if (this.isInvulnerable) {
      console.log('🛡️ Damage blocked - player is invulnerable');
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

    // Apply knockback if direction provided
    if (knockbackDirection && this.player.body) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const knockbackForce = ANIMATION_TIMINGS.KNOCKBACK.FORCE;

      // For ground-based knockback, prioritize horizontal movement with small upward boost
      const isGroundKnockback = Math.abs(knockbackDirection.y) < ANIMATION_TIMINGS.KNOCKBACK.GROUND_THRESHOLD;

      if (isGroundKnockback) {
        // Ground knockback: moderate horizontal push + small upward boost
        body.setVelocity(
          knockbackDirection.x * knockbackForce,
          -ANIMATION_TIMINGS.KNOCKBACK.UPWARD_VELOCITY
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
    const maxFlashes = ANIMATION_TIMINGS.MAX_FLASHES;

    const flashInterval = setInterval(() => {
      if (flashCount >= maxFlashes || !this.isInvulnerable) {
        clearInterval(flashInterval);
        this.player.clearTint();
        return;
      }

      // Alternate between normal and transparent
      if (flashCount % 2 === 0) {
        this.player.setTint(0xffffff); // Normal
        this.player.setAlpha(0.5); // Semi-transparent
      } else {
        this.player.setAlpha(1); // Fully visible
      }

      flashCount++;
    }, ANIMATION_TIMINGS.FLASH_INTERVAL);
  }

  public isPlayerInvulnerable(): boolean {
    return this.isInvulnerable;
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
      await this.delay(ANIMATION_TIMINGS.DAMAGED_DURATION);

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
      console.warn('Damaged animation completion interrupted:', error);
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
      await this.delay(ANIMATION_TIMINGS.INVULNERABILITY_DURATION);
      this.isInvulnerable = false;
      this.player.clearTint(); // Remove flashing effect
    } catch (error) {
      console.warn('Invulnerability end interrupted:', error);
      this.isInvulnerable = false;
      this.player.clearTint();
    }
  }

  destroy(): void {
    // Clean up timers
    if (this.invulnerabilityTimer) {
      clearTimeout(this.invulnerabilityTimer);
    }

    // Clean up event listeners
    gameEvents.off(PlayerEvent.PLAYER_ATTACKED);
    this.animationFactory.clear();
  }
}
