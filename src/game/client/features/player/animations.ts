import Phaser from 'phaser';
import type { System } from '../../shared/types';
import { Player } from './Player';
import { InputSystem } from './input';
import { gameEvents, GameEvent } from '../../shared/events';
import {
  ANIMATION_SOLDIER_IDLE_FRAMERATE,
  ANIMATION_SOLDIER_WALK_FRAMERATE,
  ANIMATION_SOLDIER_ATTACK_FRAMERATE,
} from './constants';

interface PlayerAnimationConfig {
  key: string;
  spriteKey: string;
  frames: { start: number; end: number };
  frameRate: number;
  repeat: number;
}

export class AnimationSystem implements System {
  private player: Player;
  private scene: Phaser.Scene;
  
  // Animation configurations
  private animations: Map<string, PlayerAnimationConfig> = new Map();
  
  // State tracking
  private currentAnimation: string | null = null;
  private isPlayingAttackAnimation = false;
  
  constructor(player: Player, _inputSystem: InputSystem, scene: Phaser.Scene) {
    this.player = player;
    this.scene = scene;
    
    this.setupAnimations();
    this.bindEvents();
  }
  
  private setupAnimations(): void {
    const soldierAnimations: PlayerAnimationConfig[] = [
      {
        key: 'soldier-idle-anim',
        spriteKey: 'soldier',
        frames: { start: 0, end: 5 },
        frameRate: ANIMATION_SOLDIER_IDLE_FRAMERATE,
        repeat: -1,
      },
      {
        key: 'soldier-walk-anim',
        spriteKey: 'soldier',
        frames: { start: 9, end: 16 },
        frameRate: ANIMATION_SOLDIER_WALK_FRAMERATE,
        repeat: -1,
      },
      {
        key: 'soldier-attack1-anim',
        spriteKey: 'soldier',
        frames: { start: 18, end: 22 },
        frameRate: ANIMATION_SOLDIER_ATTACK_FRAMERATE,
        repeat: 0,
      },
    ];
    
    // Create animations in Phaser and store configs
    soldierAnimations.forEach(config => {
      this.createAnimation(config);
    });
  }
  
  private createAnimation(config: PlayerAnimationConfig): void {
    this.scene.anims.create({
      key: config.key,
      frames: this.scene.anims.generateFrameNumbers(
        config.spriteKey,
        config.frames
      ),
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
    
    this.animations.set(config.key, config);
  }
  
  private bindEvents(): void {
    // Listen for combat events to handle attack animations
    gameEvents.on(GameEvent.PLAYER_ATTACKED, () => {
      this.isPlayingAttackAnimation = true;
      this.playAnimation('soldier-attack1-anim');
      
      // Listen for attack complete to reset flag
      const onAttackComplete = () => {
        this.isPlayingAttackAnimation = false;
        // Don't need to remove listener since we used 'once'
      };
      // For now, just use a timeout since we don't have the actual event
      setTimeout(onAttackComplete, 300);
    });
  }
  
  update(_time: number, _delta: number): void {
    if (!this.player.isAlive) {
      return;
    }
    
    // Don't change animations during attack
    if (this.isPlayingAttackAnimation) {
      return;
    }
    
    // Determine appropriate animation based on state
    const targetAnimation = this.determineAnimation();
    
    // Only change if different from current
    if (targetAnimation !== this.currentAnimation) {
      this.playAnimation(targetAnimation);
    }
  }
  
  private determineAnimation(): string {
    const body = this.player.body;
    
    // Climbing animations (if we have them)
    if (this.player.isClimbing) {
      // For now, use idle while climbing
      return 'soldier-idle-anim';
    }
    
    // Ground-based animations
    if (Math.abs(body.velocity.x) > 0.1) {
      return 'soldier-walk-anim';
    } else {
      return 'soldier-idle-anim';
    }
  }
  
  private playAnimation(animationKey: string): void {
    if (this.animations.has(animationKey)) {
      this.player.play(animationKey);
      this.currentAnimation = animationKey;
    } else {
      console.warn(`Animation '${animationKey}' not found`);
    }
  }
  
  // Public API
  public createCustomAnimation(
    key: string,
    spriteKey: string,
    frames: { start: number; end: number },
    frameRate: number,
    repeat: number = -1
  ): void {
    const config: PlayerAnimationConfig = {
      key,
      spriteKey,
      frames,
      frameRate,
      repeat,
    };
    
    this.createAnimation(config);
  }
  
  public forcePlayAnimation(animationKey: string): void {
    this.playAnimation(animationKey);
  }
  
  public stopAnimation(): void {
    this.player.anims.stop();
    this.currentAnimation = null;
  }
  
  public pauseAnimation(): void {
    this.player.anims.pause();
  }
  
  public resumeAnimation(): void {
    this.player.anims.resume();
  }
  
  public isAnimationPlaying(animationKey?: string): boolean {
    if (animationKey) {
      return (
        this.player.anims.isPlaying &&
        this.player.anims.currentAnim?.key === animationKey
      );
    }
    return this.player.anims.isPlaying;
  }
  
  public getCurrentAnimation(): string | null {
    return this.player.anims.currentAnim?.key || null;
  }
  
  public hasAnimation(key: string): boolean {
    return this.animations.has(key);
  }
  
  destroy(): void {
    // Clean up event listeners
    gameEvents.off(GameEvent.PLAYER_ATTACKED);
    this.animations.clear();
  }
}