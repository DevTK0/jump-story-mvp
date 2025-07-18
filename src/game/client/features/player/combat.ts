import Phaser from 'phaser';
import type { System } from '../../shared/types';
import { gameEvents, GameEvent } from '../../shared/events';
import { Player } from './Player';
import { InputSystem } from './input';
import { ATTACK_EDGE_OFFSET, ATTACK_HITBOX_POSITION_MULTIPLIER } from './constants';

export interface AttackConfig {
  name: string;
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  totalCooldownMs: number;
  arcStart: number;
  arcEnd: number;
  reach: number;
  damage: number;
}

export class CombatSystem implements System {
  private player: Player;
  private inputSystem: InputSystem;
  private scene: Phaser.Scene;
  
  // Attack configuration
  private config: AttackConfig;
  
  // Attack state
  private isOnCooldown = false;
  private attackTimer: Phaser.Time.TimerEvent | null = null;
  
  // Combat components
  private hitboxSprite: Phaser.Physics.Arcade.Sprite;
  
  // Default configuration
  private static readonly DEFAULT_CONFIG: AttackConfig = {
    name: 'basic_sword',
    startupMs: 80,
    activeMs: 100,
    recoveryMs: 120,
    totalCooldownMs: 400,
    arcStart: -30,
    arcEnd: 45,
    reach: 50,
    damage: 10,
  };
  
  constructor(
    player: Player,
    inputSystem: InputSystem,
    scene: Phaser.Scene,
    config?: AttackConfig
  ) {
    this.player = player;
    this.inputSystem = inputSystem;
    this.scene = scene;
    this.config = config || CombatSystem.DEFAULT_CONFIG;
    
    // Create hitbox for attack detection
    this.hitboxSprite = this.createHitbox();
  }
  
  private createHitbox(): Phaser.Physics.Arcade.Sprite {
    const hitbox = this.scene.physics.add.sprite(-200, -200, '');
    hitbox.setCircle(this.config.reach / 2);
    
    if (hitbox.body) {
      hitbox.body.enable = false;
      (hitbox.body as Phaser.Physics.Arcade.Body).immovable = true;
      (hitbox.body as Phaser.Physics.Arcade.Body).setGravityY(0);
    }
    
    hitbox.setVisible(false);
    return hitbox;
  }
  
  update(_time: number, _delta: number): void {
    // Check for attack input
    if (this.inputSystem.isJustPressed('attack')) {
      this.tryAttack();
    }
  }
  
  private tryAttack(): boolean {
    if (this.isOnCooldown || this.player.isAttacking) {
      return false;
    }
    
    this.performAttack();
    return true;
  }
  
  private performAttack(): void {
    const facing = this.player.facingDirection;
    const playerX = this.player.x;
    const playerY = this.player.y;
    
    // Calculate attack position
    const attackX = facing === 1 
      ? playerX + ATTACK_EDGE_OFFSET 
      : playerX - ATTACK_EDGE_OFFSET;
    
    // Position hitbox
    const hitboxX = facing === 1
      ? attackX + (this.config.reach * ATTACK_HITBOX_POSITION_MULTIPLIER)
      : attackX - (this.config.reach * ATTACK_HITBOX_POSITION_MULTIPLIER);
      
    this.hitboxSprite.setPosition(hitboxX, playerY);
    
    // Update player state
    this.player.setPlayerState({ isAttacking: true });
    this.isOnCooldown = true;
    
    // Emit attack event
    gameEvents.emit(GameEvent.PLAYER_ATTACKED, {
      type: 'melee',
      direction: facing,
    });
    
    // Attack phases
    this.executeAttackPhases();
  }
  
  private executeAttackPhases(): void {
    // Startup phase
    this.scene.time.delayedCall(this.config.startupMs, () => {
      // Active phase - enable hitbox
      if (this.hitboxSprite.body) {
        this.hitboxSprite.body.enable = true;
        const body = this.hitboxSprite.body as Phaser.Physics.Arcade.Body;
        body.reset(this.hitboxSprite.x, this.hitboxSprite.y);
      }
      
      // Emit damage event for any overlapping enemies
      gameEvents.emit(GameEvent.DAMAGE_DEALT, {
        source: 'player',
        target: 'enemy',
        damage: this.config.damage,
      });
      
      // Active phase duration
      this.scene.time.delayedCall(this.config.activeMs, () => {
        // Disable hitbox
        if (this.hitboxSprite.body) {
          this.hitboxSprite.body.enable = false;
        }
        
        // Recovery phase
        this.scene.time.delayedCall(this.config.recoveryMs, () => {
          this.player.setPlayerState({ isAttacking: false });
          this.onAttackComplete();
        });
      });
    });
  }
  
  private onAttackComplete(): void {
    // Schedule cooldown end
    const cooldownRemaining = this.config.totalCooldownMs - this.getTotalAttackDuration();
    
    this.scene.time.delayedCall(cooldownRemaining, () => {
      this.isOnCooldown = false;
    });
  }
  
  private getTotalAttackDuration(): number {
    return this.config.startupMs + this.config.activeMs + this.config.recoveryMs;
  }
  
  // Public API
  public getHitboxSprite(): Phaser.Physics.Arcade.Sprite {
    return this.hitboxSprite;
  }
  
  public isAttacking(): boolean {
    return this.player.isAttacking;
  }
  
  public canAttack(): boolean {
    return !this.isOnCooldown && !this.player.isAttacking;
  }
  
  public getConfig(): Readonly<AttackConfig> {
    return { ...this.config };
  }
  
  public setConfig(config: AttackConfig): void {
    this.config = { ...config };
    
    // Update hitbox size
    this.hitboxSprite.setCircle(this.config.reach / 2);
  }
  
  destroy(): void {
    if (this.attackTimer) {
      this.attackTimer.destroy();
    }
    this.hitboxSprite.destroy();
  }
}