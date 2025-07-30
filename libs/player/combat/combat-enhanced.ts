import Phaser from 'phaser';
import type { System } from '../../core/types';
import { emitSceneEvent } from '../../core/scene';
import { Player } from '../player';
import { InputSystem } from '../input';
import type { IDebuggable } from '@/debug/debug-interfaces';
import { DEBUG_CONFIG } from '@/debug/config';
import { BaseDebugRenderer } from '@/debug/debug-renderer';
import type { JobConfig, Attack } from './attack-types';
import { PlayerQueryService } from '../services/player-query-service';
import { CombatValidationService } from '../services/combat-validation-service';
import { CombatMessageDisplay } from './combat-message-display';
import { getAttackAnimationDuration } from '../animations/animation-duration-helper';
import type { IHitValidator } from './hit-validator-interface';

export interface AttackConfig {
  name: string;
  damage: number;
  attackType: 'standard' | 'projectile' | 'area' | 'dash';
  cooldown: number;
  critChance: number;
  knockback: number;
  hits: number;
  range: number;
  projectileSpeed?: number;
  projectileSize?: number;
  radius?: number;
  dashDistance?: number;
  dashSpeed?: number;
}

export class CombatSystemEnhanced extends BaseDebugRenderer implements System, IDebuggable, IHitValidator {
  private player: Player;
  private inputSystem: InputSystem;
  private scene: Phaser.Scene;

  // Job configuration
  private playerJob: string;
  private jobConfig: JobConfig;

  // Attack state
  private attackCooldowns: Map<number, boolean> = new Map();
  private currentAttackConfig: Attack | null = null;
  private currentAttackNum: number = 0;
  
  // Configuration
  private readonly PROJECTILE_FAN_HALF_ANGLE = 45; // degrees
  private readonly PROJECTILE_HITBOX_HEIGHT_MULTIPLIER = 10;

  // Combat components
  private hitboxSprites: Map<number, Phaser.Physics.Arcade.Sprite> = new Map();
  
  // Services
  private playerQueryService: PlayerQueryService | null = null;
  private combatValidationService: CombatValidationService | null = null;
  private messageDisplay: CombatMessageDisplay;
  
  // Physics registration
  private physicsRegistry: any = null;
  private hitCallback: Function | null = null;
  private hitContext: any = null;

  constructor(
    player: Player,
    inputSystem: InputSystem,
    scene: Phaser.Scene,
    playerJob: string,
    jobConfig: JobConfig
  ) {
    super();
    this.player = player;
    this.inputSystem = inputSystem;
    this.scene = scene;
    this.playerJob = playerJob;
    this.jobConfig = jobConfig;

    // Initialize services
    this.playerQueryService = PlayerQueryService.getInstance();
    this.combatValidationService = CombatValidationService.getInstance();
    
    // Initialize message display
    this.messageDisplay = new CombatMessageDisplay(scene);

    // Initialize hitboxes for each attack
    this.initializeHitboxes();
  }

  // Method to set up collision detection after physics is initialized
  public setupCollisions(
    enemyGroup: Phaser.Physics.Arcade.Group,
    onHitCallback: Function,
    context: any
  ): void {
    this.hitboxSprites.forEach((hitboxSprite) => {
      this.scene.physics.add.overlap(
        hitboxSprite,
        enemyGroup,
        onHitCallback as any,
        undefined,
        context
      );
    });
  }

  // New method to register hitboxes with PhysicsRegistry
  public registerHitboxPhysics(
    registry: any, // Using any to avoid circular dependency
    onHitCallback: Function,
    context: any
  ): void {
    // Store references for re-registration after job changes
    this.physicsRegistry = registry;
    this.hitCallback = onHitCallback;
    this.hitContext = context;
    
    // Register each hitbox sprite to overlap with enemies
    this.hitboxSprites.forEach((hitboxSprite) => {
      registry.addOverlap(
        hitboxSprite,
        'enemies',
        onHitCallback,
        undefined,
        context
      );
    });
  }

  private initializeHitboxes(): void {
    // Create hitbox sprites for each attack (standard, dash, and projectile)
    for (let i = 1; i <= 3; i++) {
      const attackConfig = this.jobConfig.attacks[`attack${i}` as keyof typeof this.jobConfig.attacks];
      if (attackConfig && (attackConfig.attackType === 'standard' || attackConfig.attackType === 'dash' || attackConfig.attackType === 'projectile')) {
        const hitbox = this.scene.physics.add.sprite(-200, -200, '');
        // Will be sized dynamically during attack

        if (hitbox.body) {
          const body = hitbox.body as Phaser.Physics.Arcade.Body;
          body.enable = false;
          body.immovable = true;
          body.setGravityY(0);
          body.setAllowGravity(false);
          body.moves = false;
        }

        hitbox.setVisible(false);
        this.hitboxSprites.set(i, hitbox);
      }
    }
  }

  public setSyncManager(_syncManager: any): void {
    // State machine handles synchronization
  }

  public setDbConnection(dbConnection: any): void {
    // Update services with the connection
    this.playerQueryService = PlayerQueryService.getInstance(dbConnection);
    this.combatValidationService = CombatValidationService.getInstance(dbConnection);
  }

  update(_time: number, _delta: number): void {
    // Check for attack inputs
    if (this.inputSystem.isJustPressed('attack1')) {
      this.tryAttack(1);
    } else if (this.inputSystem.isJustPressed('attack2')) {
      this.tryAttack(2);
    } else if (this.inputSystem.isJustPressed('attack3')) {
      this.tryAttack(3);
    }
  }

  private tryAttack(attackNum: number): boolean {
    if (this.attackCooldowns.get(attackNum) || this.player.isAttacking) {
      return false;
    }

    // Cannot attack when climbing or dead
    if (this.player.isClimbing || this.player.getStateMachine().isInState('Dead')) {
      return false;
    }

    const attackConfig = this.jobConfig.attacks[`attack${attackNum}` as keyof typeof this.jobConfig.attacks];
    if (!attackConfig) {
      return false;
    }

    // Client-side validation
    if (this.playerQueryService && this.combatValidationService) {
      // Check mana
      const currentMana = this.playerQueryService.getCurrentPlayerMana() ?? 0;
      const manaResult = this.combatValidationService.canUseAttack(attackNum, this.jobConfig, currentMana);
      
      if (!manaResult.canAttack) {
        this.messageDisplay.showMessage(manaResult.reason || 'Cannot use attack');
        return false;
      }

      // Check cooldown
      const cooldownResult = this.combatValidationService.checkCooldownWithConfig(attackNum, attackConfig);
      if (!cooldownResult.canAttack) {
        this.messageDisplay.showMessage(cooldownResult.reason || 'Attack on cooldown');
        return false;
      }
    }

    // Handle attack types
    switch (attackConfig.attackType) {
      case 'standard':
        this.performStandardAttack(attackNum, attackConfig);
        break;
      case 'dash':
        this.performDashAttack(attackNum, attackConfig);
        break;
      case 'projectile':
        this.performProjectileAttack(attackNum, attackConfig);
        break;
      default:
        console.log(`Attack type ${attackConfig.attackType} not yet implemented`);
    }

    return true;
  }

  /**
   * Common attack setup logic for all attack types
   */
  private setupAttack(attackNum: number, config: Attack): Phaser.Physics.Arcade.Sprite | null {
    // Track current attack
    this.currentAttackConfig = config;
    this.currentAttackNum = attackNum;

    // Get or create hitbox sprite
    const hitboxSprite = this.hitboxSprites.get(attackNum);
    if (!hitboxSprite) return null;

    // Update player state
    this.player.setPlayerState({ isAttacking: true });
    this.attackCooldowns.set(attackNum, true);

    // Transition to attack state so it syncs to server and peers can see it
    const attackStateName = `Attack${attackNum}`;
    if (this.player.getStateMachine().canTransitionTo(attackStateName)) {
      this.player.getStateMachine().transitionTo(attackStateName);
    }

    // Emit skill activation event for UI tracking
    emitSceneEvent(this.scene, 'skill:activated', {
      slotIndex: attackNum - 1, // Convert 1-3 to 0-2 for UI
      skillName: config.name,
      cooldown: config.cooldown
    });

    return hitboxSprite;
  }

  /**
   * Configure hitbox dimensions and position
   */
  private configureHitbox(
    hitboxSprite: Phaser.Physics.Arcade.Sprite,
    config: Attack,
    attackType: 'standard' | 'dash' | 'projectile'
  ): void {
    const facing = this.player.facingDirection;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;

    // Calculate hitbox dimensions based on attack type
    const hitboxWidth = playerBody.width + config.range;
    const hitboxHeight = attackType === 'projectile' 
      ? playerBody.height * this.PROJECTILE_HITBOX_HEIGHT_MULTIPLIER
      : playerBody.height;

    // Calculate hitbox position
    const playerCenterX = playerBody.x + playerBody.halfWidth;
    const playerCenterY = playerBody.y + playerBody.halfHeight;
    const hitboxCenterX = playerCenterX + (facing * config.range / 2);
    
    // Update hitbox sprite position
    hitboxSprite.setPosition(hitboxCenterX, playerCenterY);

    // Update physics body size
    if (hitboxSprite.body) {
      const body = hitboxSprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(hitboxWidth, hitboxHeight);
    }
  }

  private performStandardAttack(attackNum: number, config: Attack): void {
    const hitboxSprite = this.setupAttack(attackNum, config);
    if (!hitboxSprite) return;

    this.configureHitbox(hitboxSprite, config, 'standard');

    // Emit attack event
    emitSceneEvent(this.scene, 'player:attacked', {
      type: 'standard',
      direction: this.player.facingDirection,
      attackType: attackNum,
      damage: config.damage,
      critChance: config.critChance,
    });

    // Execute attack phases
    this.executeAttackPhases(attackNum, config, hitboxSprite);
  }

  private performDashAttack(attackNum: number, config: Attack): void {
    // Type guard to ensure we have a dash attack
    if (config.attackType !== 'dash') return;

    const hitboxSprite = this.setupAttack(attackNum, config);
    if (!hitboxSprite) return;

    this.configureHitbox(hitboxSprite, config, 'dash');

    // Update player state for dashing
    this.player.setPlayerState({ isDashing: true });

    // Emit attack event
    emitSceneEvent(this.scene, 'player:attacked', {
      type: 'dash',
      direction: this.player.facingDirection,
      attackType: attackNum,
      damage: config.damage,
      critChance: config.critChance,
    });

    // Execute dash attack phases (with dash movement)
    this.executeDashAttackPhases(attackNum, config, hitboxSprite);
  }

  private async executeAttackPhases(
    attackNum: number,
    config: AttackConfig,
    hitboxSprite: Phaser.Physics.Arcade.Sprite
  ): Promise<void> {
    try {
      // Use actual sprite animation duration for all jobs
      let animationDuration: number;
      try {
        animationDuration = getAttackAnimationDuration(this.playerJob, attackNum);
      } catch (error) {
        console.error(`Failed to get attack animation duration for ${this.playerJob} attack${attackNum}:`, error);
        animationDuration = 300; // Fallback duration
      }
      
      // Calculate phase durations based on actual animation timing
      const startupMs = animationDuration * 0.2;  // 20% for windup
      const activeMs = animationDuration * 0.6;   // 60% for damage frames
      const recoveryMs = animationDuration * 0.2; // 20% for recovery

      // Startup phase
      await this.delay(startupMs);

      // Active phase - enable hitbox
      if (hitboxSprite.body) {
        // Update hitbox position to current player position before enabling
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const facing = this.player.facingDirection;
        
        // Recalculate position with forward extension
        const playerCenterX = playerBody.x + playerBody.halfWidth;
        const playerCenterY = playerBody.y + playerBody.halfHeight;
        const hitboxCenterX = playerCenterX + (facing * config.range / 2);
        
        hitboxSprite.setPosition(hitboxCenterX, playerCenterY);
        
        const body = hitboxSprite.body as Phaser.Physics.Arcade.Body;
        body.reset(hitboxCenterX, playerCenterY);
        body.enable = true;
        // Ensure physics properties are maintained after reset
        body.setGravityY(0);
        body.setAllowGravity(false);
        body.immovable = true;
        body.moves = false;
      }

      // Damage is handled directly by collision detection

      // Active phase duration
      await this.delay(activeMs);

      // Disable hitbox
      if (hitboxSprite.body) {
        hitboxSprite.body.enable = false;
      }

      // Recovery phase
      await this.delay(recoveryMs);

      this.player.setPlayerState({ isAttacking: false });
      this.resetCurrentAttack();

      // Transition to appropriate state based on player movement
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const transitioned = Math.abs(body.velocity.x) > 0.1
        ? this.player.transitionToState('Walk')
        : this.player.transitionToState('Idle');
      
      if (!transitioned) {
        console.warn(`Failed to transition from attack state after standard attack ${attackNum}`);
        // Force transition to idle if normal transition fails
        this.player.getStateMachine().transitionTo('Idle');
      }
      
      // Start cooldown timer for next attack availability
      this.startCooldown(attackNum, config.cooldown);
    } catch (error) {
      console.warn('Attack execution interrupted:', error);
      this.cleanupAttack(attackNum, hitboxSprite);
    }
  }

  private startCooldown(attackNum: number, cooldownMs: number): void {
    this.scene.time.delayedCall(cooldownMs, () => {
      this.attackCooldowns.set(attackNum, false);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(ms, resolve);
    });
  }

  private async executeDashAttackPhases(
    attackNum: number,
    config: Attack,
    hitboxSprite: Phaser.Physics.Arcade.Sprite
  ): Promise<void> {
    // Type guard to ensure we have a dash attack
    if (config.attackType !== 'dash') return;

    try {
      let animationDuration: number;
      try {
        animationDuration = getAttackAnimationDuration(this.playerJob, attackNum);
      } catch (error) {
        console.error(`Failed to get attack animation duration for ${this.playerJob} attack${attackNum}:`, error);
        animationDuration = 300; // Fallback duration
      }
      
      // Ensure minimum duration for dash attacks
      const MIN_DASH_DURATION = 800; // Minimum 800ms for dash attacks
      const effectiveDuration = Math.max(animationDuration, MIN_DASH_DURATION);
      
      // Calculate phase durations
      const startupMs = effectiveDuration * 0.15;  // 15% for windup
      const dashMs = effectiveDuration * 0.5;      // 50% for dash movement
      const activeMs = effectiveDuration * 0.2;    // 20% for damage frames
      const recoveryMs = effectiveDuration * 0.15; // 15% for recovery

      // Startup phase
      await this.delay(startupMs);

      // Store original velocity
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      const originalVelocityX = playerBody.velocity.x;
      const facing = this.player.facingDirection;

      // Start dash movement
      const dashVelocity = config.dashSpeed * facing;
      playerBody.setVelocityX(dashVelocity);

      // Enable hitbox during dash
      if (hitboxSprite.body) {
        const body = hitboxSprite.body as Phaser.Physics.Arcade.Body;
        // Reset body before enabling to clear any accumulated velocity
        body.reset(hitboxSprite.x, hitboxSprite.y);
        body.enable = true;
        body.setGravityY(0);
        body.setAllowGravity(false);
        body.immovable = true;
        body.moves = false; // Prevent physics from moving the hitbox
      }

      // Dash duration - update hitbox position during dash
      const dashSteps = 10;
      const stepDelay = dashMs / dashSteps;
      
      for (let i = 0; i < dashSteps; i++) {
        // Update hitbox position to follow player
        const playerCenterX = playerBody.x + playerBody.halfWidth;
        const playerCenterY = playerBody.y + playerBody.halfHeight;
        const hitboxCenterX = playerCenterX + (facing * config.range / 2);
        
        hitboxSprite.setPosition(hitboxCenterX, playerCenterY);
        
        await this.delay(stepDelay);
      }

      // Active phase (damage still happening)
      await this.delay(activeMs);

      // Disable hitbox
      if (hitboxSprite.body) {
        hitboxSprite.body.enable = false;
      }

      // Restore original velocity (or stop if player was stationary)
      playerBody.setVelocityX(Math.abs(originalVelocityX) < 10 ? 0 : originalVelocityX);

      // Recovery phase
      await this.delay(recoveryMs);

      this.player.setPlayerState({ isAttacking: false, isDashing: false });

      // Transition to appropriate state
      const transitioned = Math.abs(playerBody.velocity.x) > 0.1 
        ? this.player.transitionToState('Walk')
        : this.player.transitionToState('Idle');
      
      if (!transitioned) {
        console.warn(`Failed to transition from attack state after dash attack ${attackNum}`);
        // Force transition to idle if normal transition fails
        this.player.getStateMachine().transitionTo('Idle');
      }
      
      // Start cooldown timer
      this.startCooldown(attackNum, config.cooldown);
    } catch (error) {
      console.warn('Dash attack execution interrupted:', error);
      this.cleanupAttack(attackNum, hitboxSprite);
    }
  }

  private cleanupAttack(attackNum: number, hitboxSprite: Phaser.Physics.Arcade.Sprite): void {
    // Disable hitbox
    if (hitboxSprite.body) {
      hitboxSprite.body.enable = false;
    }

    // Reset player state
    this.player.setPlayerState({ isAttacking: false, isDashing: false });
    this.resetCurrentAttack();
    this.attackCooldowns.set(attackNum, false);
  }


  private performProjectileAttack(attackNum: number, config: Attack): void {
    // Type guard to ensure we have a projectile attack
    if (config.attackType !== 'projectile') return;
    
    const hitboxSprite = this.setupAttack(attackNum, config);
    if (!hitboxSprite) return;

    this.configureHitbox(hitboxSprite, config, 'projectile');

    // Emit attack event
    emitSceneEvent(this.scene, 'player:attacked', {
      type: 'projectile',
      direction: this.player.facingDirection,
      attackType: attackNum,
      damage: config.damage,
      critChance: config.critChance,
      projectile: config.projectile,
    });

    // Execute projectile attack phases with hitbox
    this.executeProjectileAttackPhases(attackNum, config, hitboxSprite);
  }

  private async executeProjectileAttackPhases(
    attackNum: number,
    config: Attack,
    hitboxSprite: Phaser.Physics.Arcade.Sprite
  ): Promise<void> {
    try {
      // Use actual sprite animation duration
      let animationDuration: number;
      try {
        animationDuration = getAttackAnimationDuration(this.playerJob, attackNum);
      } catch (error) {
        console.error(`Failed to get attack animation duration for ${this.playerJob} attack${attackNum}:`, error);
        animationDuration = 300; // Fallback duration
      }
      
      // Calculate phase durations based on actual animation timing
      const startupMs = animationDuration * 0.2;  // 20% for windup
      const activeMs = animationDuration * 0.6;   // 60% for damage frames
      const recoveryMs = animationDuration * 0.2; // 20% for recovery

      // Startup phase
      await this.delay(startupMs);

      // Active phase - enable hitbox
      if (hitboxSprite.body) {
        // Update hitbox position to current player position before enabling
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        const facing = this.player.facingDirection;
        
        // Recalculate position with forward extension
        const playerCenterX = playerBody.x + playerBody.halfWidth;
        const playerCenterY = playerBody.y + playerBody.halfHeight;
        const hitboxCenterX = playerCenterX + (facing * config.range / 2);
        
        hitboxSprite.setPosition(hitboxCenterX, playerCenterY);
        
        const body = hitboxSprite.body as Phaser.Physics.Arcade.Body;
        body.reset(hitboxCenterX, playerCenterY);
        body.enable = true;
        // Ensure physics properties are maintained after reset
        body.setGravityY(0);
        body.setAllowGravity(false);
        body.immovable = true;
        body.moves = false;
      }

      // Damage is handled directly by collision detection

      // Active phase duration
      await this.delay(activeMs);

      // Disable hitbox
      if (hitboxSprite.body) {
        hitboxSprite.body.enable = false;
      }

      // Recovery phase
      await this.delay(recoveryMs);

      this.player.setPlayerState({ isAttacking: false });
      this.resetCurrentAttack();

      // Transition to appropriate state based on player movement
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const transitioned = Math.abs(body.velocity.x) > 0.1
        ? this.player.transitionToState('Walk')
        : this.player.transitionToState('Idle');
      
      if (!transitioned) {
        console.warn(`Failed to transition from attack state after projectile attack ${attackNum}`);
        this.player.getStateMachine().transitionTo('Idle');
      }
      
      this.startCooldown(attackNum, config.cooldown);
    } catch (error) {
      console.warn('Projectile attack execution interrupted:', error);
      this.cleanupAttack(attackNum, hitboxSprite);
    }
  }

  // Public API - Compatibility with existing physics system
  public getHitboxSprite(): Phaser.Physics.Arcade.Sprite {
    // Return the currently active hitbox or first one
    for (const [, sprite] of this.hitboxSprites) {
      if (sprite.body?.enable) {
        return sprite;
      }
    }
    // Default to first hitbox
    return this.hitboxSprites.get(1) || this.createDummyHitbox();
  }

  private createDummyHitbox(): Phaser.Physics.Arcade.Sprite {
    const dummy = this.scene.physics.add.sprite(-1000, -1000, '');
    dummy.body.enable = false;
    return dummy;
  }

  public getAllHitboxSprites(): Phaser.Physics.Arcade.Sprite[] {
    return Array.from(this.hitboxSprites.values());
  }

  public isAttacking(): boolean {
    return this.player.isAttacking;
  }

  public canAttack(attackNum: number): boolean {
    return !this.attackCooldowns.get(attackNum) && !this.player.isAttacking;
  }

  public getJobConfig(): JobConfig {
    return this.jobConfig;
  }

  public getPlayerJob(): string {
    return this.playerJob;
  }

  /**
   * Check if a hit is valid for the current attack type
   * For projectile attacks, this performs a fan angle check
   */
  public isHitValid(enemySprite: Phaser.GameObjects.Sprite): boolean {
    // If no attack is active or it's not a projectile, allow the hit
    if (!this.currentAttackConfig || this.currentAttackConfig.attackType !== 'projectile') {
      return true;
    }

    // For projectile attacks, check if enemy is within fan angle
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const playerCenterX = playerBody.x + playerBody.halfWidth;
    const playerCenterY = playerBody.y + playerBody.halfHeight;
    
    // Calculate vector from player to enemy
    const enemyBody = enemySprite.body as Phaser.Physics.Arcade.Body;
    const enemyCenterX = enemyBody.x + enemyBody.halfWidth;
    const enemyCenterY = enemyBody.y + enemyBody.halfHeight;
    
    const deltaX = enemyCenterX - playerCenterX;
    const deltaY = enemyCenterY - playerCenterY;
    
    // Normalize the vector
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance === 0) return true; // Enemy is on top of player
    
    const normalizedX = deltaX / distance;
    const normalizedY = deltaY / distance;
    
    // Player facing vector (1 = right, -1 = left)
    const facingX = this.player.facingDirection;
    const facingY = 0;
    
    // Calculate angle between vectors using dot product
    const dotProduct = normalizedX * facingX + normalizedY * facingY;
    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct))); // Clamp to avoid NaN
    
    // Convert to degrees
    const angleDegrees = angle * (180 / Math.PI);
    
    // Check if within fan angle
    return angleDegrees <= this.PROJECTILE_FAN_HALF_ANGLE;
  }

  /**
   * Reset current attack tracking
   */
  public resetCurrentAttack(): void {
    this.currentAttackConfig = null;
    this.currentAttackNum = 0;
  }

  public setPlayerJob(jobName: string, jobConfig: JobConfig): void {
    this.playerJob = jobName;
    this.jobConfig = jobConfig;
    // Reinitialize hitboxes with new job config
    this.destroyHitboxes();
    this.initializeHitboxes();
    
    // Re-register new hitboxes with physics if we have a registry
    if (this.physicsRegistry && this.hitCallback && this.hitContext) {
      this.hitboxSprites.forEach((hitboxSprite) => {
        this.physicsRegistry.addOverlap(
          hitboxSprite,
          'enemies',
          this.hitCallback,
          undefined,
          this.hitContext
        );
      });
    }
  }

  // Debug rendering
  protected performDebugRender(graphics: Phaser.GameObjects.Graphics): void {
    // Render all active hitboxes
    this.hitboxSprites.forEach((hitboxSprite, attackNum) => {
      if (this.player.isAttacking && hitboxSprite.body?.enable) {
        const body = hitboxSprite.body as Phaser.Physics.Arcade.Body;

        // Draw the physics body rectangle (like the debug system does)
        graphics.lineStyle(3, DEBUG_CONFIG.colors.attackHitbox, 1.0);
        graphics.fillStyle(DEBUG_CONFIG.colors.attackHitbox, 0.3);
        graphics.fillRect(body.x, body.y, body.width, body.height);
        graphics.strokeRect(body.x, body.y, body.width, body.height);

        // Draw center point
        graphics.fillStyle(0xff0000, 1.0);
        graphics.fillCircle(body.x + body.halfWidth, body.y + body.halfHeight, 3);

        // Draw range indicator line showing the extended range
        const attack = this.jobConfig.attacks[`attack${attackNum}` as keyof typeof this.jobConfig.attacks];
        if (attack && attack.range > 0) {
          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          const playerCenterX = playerBody.x + playerBody.halfWidth;
          
          graphics.lineStyle(2, 0x00ff00, 0.8);
          graphics.beginPath();
          graphics.moveTo(playerCenterX, body.y);
          graphics.lineTo(playerCenterX, body.y + body.height);
          graphics.strokePath();
          
          // Draw range text (we would need a text object for this, skipping for now)
        }
      }
    });
  }

  protected provideDebugInfo(): Record<string, any> {
    const cooldowns: Record<string, boolean> = {};
    this.attackCooldowns.forEach((value, key) => {
      cooldowns[`attack${key}`] = value;
    });

    return {
      playerJob: this.playerJob,
      isAttacking: this.player.isAttacking,
      health: this.jobConfig.baseStats.health,
      moveSpeed: this.jobConfig.baseStats.moveSpeed,
      cooldowns,
    };
  }

  private destroyHitboxes(): void {
    this.hitboxSprites.forEach((sprite) => sprite.destroy());
    this.hitboxSprites.clear();
  }

  destroy(): void {
    this.destroyHitboxes();
    this.messageDisplay.destroy();
  }
}
