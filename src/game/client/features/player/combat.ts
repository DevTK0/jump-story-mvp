import Phaser from 'phaser';
import type { System } from '../../shared/types';
import { gameEvents, GameEvent } from '../../shared/events';
import { Player } from './player';
import { InputSystem } from './input';
import { ATTACK_EDGE_OFFSET, ATTACK_HITBOX_POSITION_MULTIPLIER } from './constants';
import type { IDebuggable } from '../../shared/debug';
import { DEBUG_CONFIG, BaseDebugRenderer } from '../../shared/debug';

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

export class CombatSystem extends BaseDebugRenderer implements System, IDebuggable {
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
  
  // Attack configurations for each attack type
  private static readonly ATTACK_CONFIGS: Record<number, AttackConfig> = {
    1: {
      name: 'quick_slash',
      startupMs: 60,
      activeMs: 80,
      recoveryMs: 100,
      totalCooldownMs: 300,
      arcStart: -30,
      arcEnd: 45,
      reach: 45,
      damage: 8,
    },
    2: {
      name: 'heavy_strike',
      startupMs: 120,
      activeMs: 150,
      recoveryMs: 180,
      totalCooldownMs: 600,
      arcStart: -45,
      arcEnd: 60,
      reach: 60,
      damage: 15,
    },
    3: {
      name: 'combo_attack',
      startupMs: 100,
      activeMs: 120,
      recoveryMs: 140,
      totalCooldownMs: 450,
      arcStart: -35,
      arcEnd: 50,
      reach: 55,
      damage: 12,
    },
  };
  
  constructor(
    player: Player,
    inputSystem: InputSystem,
    scene: Phaser.Scene,
    config?: AttackConfig
  ) {
    super();
    this.player = player;
    this.inputSystem = inputSystem;
    this.scene = scene;
    this.config = config || CombatSystem.ATTACK_CONFIGS[1];
    
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
    if (this.inputSystem.isJustPressed('attack1')) {
      this.tryAttack(1);
    } else if (this.inputSystem.isJustPressed('attack2')) {
      this.tryAttack(2);
    } else if (this.inputSystem.isJustPressed('attack3')) {
      this.tryAttack(3);
    }
  }
  
  private tryAttack(attackType: number): boolean {
    if (this.isOnCooldown || this.player.isAttacking) {
      return false;
    }
    
    // Cannot attack when climbing or on climbeable surface
    if (this.player.isClimbing) {
      return false;
    }
    
    // Check if player is on climbeable surface
    const climbingSystem = this.player.getSystem('climbing');
    if (climbingSystem && 'isPlayerOnClimbeable' in climbingSystem) {
      if ((climbingSystem as any).isPlayerOnClimbeable()) {
        return false;
      }
    }
    
    this.performAttack(attackType);
    return true;
  }
  
  private performAttack(attackType: number): void {
    // Get the specific attack configuration
    const attackConfig = CombatSystem.ATTACK_CONFIGS[attackType];
    
    const facing = this.player.facingDirection;
    const playerX = this.player.x;
    const playerY = this.player.y;
    
    // Calculate attack position using the specific attack's reach
    const attackX = facing === 1 
      ? playerX + ATTACK_EDGE_OFFSET 
      : playerX - ATTACK_EDGE_OFFSET;
    
    // Position hitbox using the specific attack's reach
    const hitboxX = facing === 1
      ? attackX + (attackConfig.reach * ATTACK_HITBOX_POSITION_MULTIPLIER)
      : attackX - (attackConfig.reach * ATTACK_HITBOX_POSITION_MULTIPLIER);
      
    this.hitboxSprite.setPosition(hitboxX, playerY);
    
    // Update hitbox size for this attack
    this.hitboxSprite.setCircle(attackConfig.reach / 2);
    
    // Update player state
    this.player.setPlayerState({ isAttacking: true });
    this.isOnCooldown = true;
    
    // Emit attack event with attack type information
    gameEvents.emit(GameEvent.PLAYER_ATTACKED, {
      type: 'melee',
      direction: facing,
      attackType: attackType,
    });
    
    // Attack phases using the specific attack configuration
    this.executeAttackPhases(attackConfig);
  }
  
  private executeAttackPhases(attackConfig: AttackConfig): void {
    // Startup phase
    this.scene.time.delayedCall(attackConfig.startupMs, () => {
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
        damage: attackConfig.damage,
      });
      
      // Active phase duration
      this.scene.time.delayedCall(attackConfig.activeMs, () => {
        // Disable hitbox
        if (this.hitboxSprite.body) {
          this.hitboxSprite.body.enable = false;
        }
        
        // Recovery phase
        this.scene.time.delayedCall(attackConfig.recoveryMs, () => {
          this.player.setPlayerState({ isAttacking: false });
          this.onAttackComplete(attackConfig);
        });
      });
    });
  }
  
  private onAttackComplete(attackConfig: AttackConfig): void {
    // Schedule cooldown end
    const cooldownRemaining = attackConfig.totalCooldownMs - this.getTotalAttackDuration(attackConfig);
    
    this.scene.time.delayedCall(cooldownRemaining, () => {
      this.isOnCooldown = false;
    });
  }
  
  private getTotalAttackDuration(attackConfig: AttackConfig): number {
    return attackConfig.startupMs + attackConfig.activeMs + attackConfig.recoveryMs;
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
  
  // Debug rendering implementation
  protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
    // Always show attack hitbox when attacking (even if body is not enabled)
    if (this.player.isAttacking) {
      const body = this.hitboxSprite.body as Phaser.Physics.Arcade.Body;
      const radius = body.halfWidth;
      
      // Draw attack hitbox circle with different style based on whether it's active
      if (this.hitboxSprite.body?.enable) {
        // Active hitbox - solid and bright
        graphics.lineStyle(3, DEBUG_CONFIG.colors.attackHitbox, 1.0);
        graphics.fillStyle(DEBUG_CONFIG.colors.attackHitbox, 0.3);
      } else {
        // Inactive hitbox - dashed and dim
        graphics.lineStyle(2, DEBUG_CONFIG.colors.attackHitbox, 0.5);
        graphics.fillStyle(DEBUG_CONFIG.colors.attackHitbox, 0.1);
      }
      
      graphics.fillCircle(this.hitboxSprite.x, this.hitboxSprite.y, radius);
      graphics.strokeCircle(this.hitboxSprite.x, this.hitboxSprite.y, radius);
    }
  }
  
  protected provideDebugInfo(): Record<string, any> {
    return {
      isAttacking: this.player.isAttacking,
      canAttack: this.canAttack(),
      isOnCooldown: this.isOnCooldown,
      attackConfig: this.config.name,
      hitboxEnabled: this.hitboxSprite.body?.enable || false,
    };
  }
  
  
  destroy(): void {
    if (this.attackTimer) {
      this.attackTimer.destroy();
    }
    this.hitboxSprite.destroy();
  }
}