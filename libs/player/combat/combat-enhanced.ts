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

export interface AttackConfig {
  name: string;
  damage: number;
  attackType: 'standard' | 'projectile' | 'area';
  cooldown: number;
  critChance: number;
  knockback: number;
  hits: number;
  range: number;
  projectileSpeed?: number;
  projectileSize?: number;
  radius?: number;
}

export class CombatSystemEnhanced extends BaseDebugRenderer implements System, IDebuggable {
  private player: Player;
  private inputSystem: InputSystem;
  private scene: Phaser.Scene;

  // Job configuration
  private playerJob: string;
  private jobConfig: JobConfig;

  // Attack state
  private attackCooldowns: Map<number, boolean> = new Map();

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
    // Create hitbox sprites for each standard attack
    for (let i = 1; i <= 3; i++) {
      const attackConfig = this.jobConfig.attacks[`attack${i}` as keyof typeof this.jobConfig.attacks];
      if (attackConfig && attackConfig.attackType === 'standard') {
        const hitbox = this.scene.physics.add.sprite(-200, -200, '');
        // Will be sized dynamically during attack

        if (hitbox.body) {
          hitbox.body.enable = false;
          (hitbox.body as Phaser.Physics.Arcade.Body).immovable = true;
          (hitbox.body as Phaser.Physics.Arcade.Body).setGravityY(0);
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

    // Handle standard attacks
    if (attackConfig.attackType === 'standard') {
      this.performStandardAttack(attackNum, attackConfig);
    } else {
      console.log(`Attack type ${attackConfig.attackType} not yet implemented`);
    }

    return true;
  }

  private performStandardAttack(attackNum: number, config: Attack): void {
    const facing = this.player.facingDirection;

    // Get or create hitbox sprite
    const hitboxSprite = this.hitboxSprites.get(attackNum);
    if (!hitboxSprite) return;

    // Get actual player body
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;

    // Calculate hitbox dimensions
    // Width = player width + attack range (extended forward)
    // Height = player height (unchanged)
    const hitboxWidth = playerBody.width + config.range;
    const hitboxHeight = playerBody.height;

    // Calculate hitbox position
    // The hitbox extends forward from the player in the facing direction
    const playerCenterX = playerBody.x + playerBody.halfWidth;
    const playerCenterY = playerBody.y + playerBody.halfHeight;
    
    // Offset the hitbox center by half the range in the facing direction
    const hitboxCenterX = playerCenterX + (facing * config.range / 2);
    
    // Update hitbox sprite position
    hitboxSprite.setPosition(hitboxCenterX, playerCenterY);

    // Update physics body size and offset
    if (hitboxSprite.body) {
      const body = hitboxSprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(hitboxWidth, hitboxHeight);
    }

    // Update player state
    this.player.setPlayerState({ isAttacking: true });
    this.attackCooldowns.set(attackNum, true);

    // Transition to attack state
    const attackStateName = `Attack${attackNum}`;
    if (this.player.getStateMachine().canTransitionTo(attackStateName)) {
      this.player.transitionToState(attackStateName);
    }

    // Emit attack event using type-safe helper
    emitSceneEvent(this.scene, 'player:attacked', {
      type: 'standard',
      direction: facing,
      attackType: attackNum,
      damage: config.damage,
      critChance: config.critChance,
    });

    // Execute attack phases
    this.executeAttackPhases(attackNum, config, hitboxSprite);
  }

  private async executeAttackPhases(
    attackNum: number,
    config: AttackConfig,
    hitboxSprite: Phaser.Physics.Arcade.Sprite
  ): Promise<void> {
    try {
      // Calculate phase durations based on animation
      const totalDuration = config.cooldown * 0.6; // 60% for animation, 40% for cooldown
      const startupMs = totalDuration * 0.3;
      const activeMs = totalDuration * 0.4;
      const recoveryMs = totalDuration * 0.3;

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
        
        hitboxSprite.body.enable = true;
        const body = hitboxSprite.body as Phaser.Physics.Arcade.Body;
        body.reset(hitboxCenterX, playerCenterY);
        // Ensure physics properties are maintained after reset
        body.setGravityY(0);
        body.immovable = true;
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

      // Start cooldown timer
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

  private cleanupAttack(attackNum: number, hitboxSprite: Phaser.Physics.Arcade.Sprite): void {
    // Disable hitbox
    if (hitboxSprite.body) {
      hitboxSprite.body.enable = false;
    }

    // Reset player state
    this.player.setPlayerState({ isAttacking: false });
    this.attackCooldowns.set(attackNum, false);
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
