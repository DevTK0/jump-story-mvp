import Phaser from 'phaser';
import { DbConnection, Spawn as ServerSpawn, PlayerState } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { createLogger } from '@/core/logger';
import { ENEMY_CONFIG } from './config/enemy-config';
import { BossHealthBar } from './ui/boss-health-bar';
import { EnemyStateMachine } from './state/enemy-state-machine';
import { bossAttributes } from '../../apps/playground/config/enemy-attributes';
import type { PhysicsEntity } from '@/core/physics/physics-entity';
import type { PhysicsRegistry } from '@/core/physics/physics-registry';
import { BossSubscriptionManager, type BossSubscriptionConfig } from './managers/boss-subscription-manager';

/**
 * Manages boss entities - larger, more powerful enemies
 */
export class BossManager implements PhysicsEntity {
  private scene: Phaser.Scene;
  private logger = createLogger('BossManager');
  private subscriptionManager: BossSubscriptionManager;

  // Boss tracking
  private bosses = new Map<number, Phaser.Physics.Arcade.Sprite>();
  private bossHealthBars = new Map<number, BossHealthBar>();
  private bossStateMachines = new Map<number, EnemyStateMachine>();
  private bossNameLabels = new Map<number, Phaser.GameObjects.Text>();
  private bossGroup: Phaser.Physics.Arcade.Group;
  private bossStates = new Map<number, PlayerState>();

  constructor(scene: Phaser.Scene, subscriptionConfig?: Partial<BossSubscriptionConfig>) {
    this.scene = scene;
    this.bossGroup = this.scene.physics.add.group();
    
    // Initialize subscription manager with callbacks
    this.subscriptionManager = new BossSubscriptionManager(
      scene,
      {
        onBossInsert: this.handleBossInsert.bind(this),
        onBossUpdate: this.handleBossUpdate.bind(this),
        onBossDelete: this.handleBossDelete.bind(this),
        onProximityLoad: this.handleProximityLoad.bind(this),
      },
      subscriptionConfig
    );
  }

  public setDbConnection(connection: DbConnection): void {
    this.logger.info('Setting database connection');
    this.subscriptionManager.setDbConnection(connection);
  }
  
  public setLocalPlayerIdentity(identity: Identity): void {
    this.subscriptionManager.setLocalPlayerIdentity(identity);
  }

  /**
   * Handle boss insertion from subscription
   */
  private handleBossInsert(boss: ServerSpawn): void {
    this.logger.info('Boss insert event received:', { enemy: boss.enemy, position: { x: boss.x, y: boss.y } });
    this.spawnBoss(boss);
    
    // Emit boss spawn event
    this.scene.events.emit('boss:spawned', {
      enemy: boss.enemy,
      spawnId: boss.spawnId,
      x: boss.x,
      y: boss.y
    });
  }

  /**
   * Handle boss update from subscription
   */
  private handleBossUpdate(boss: ServerSpawn): void {
    this.logger.info('Boss update event received:', { enemy: boss.enemy, position: { x: boss.x, y: boss.y } });
    this.updateBoss(boss);
  }

  /**
   * Handle boss deletion from subscription
   */
  private handleBossDelete(spawnId: number): void {
    this.logger.info('Boss delete event received:', { spawnId });
    this.despawnBoss(spawnId);
    
    // Emit boss despawn event
    this.scene.events.emit('boss:despawned', { spawnId });
  }

  /**
   * Handle proximity load of multiple bosses
   */
  private handleProximityLoad(bosses: ServerSpawn[]): void {
    const currentBossIds = new Set<number>();

    // Spawn bosses that are within proximity
    for (const boss of bosses) {
      currentBossIds.add(boss.spawnId);
      if (!this.bosses.has(boss.spawnId)) {
        this.logger.info('Spawning boss from proximity load:', { enemy: boss.enemy, position: { x: boss.x, y: boss.y } });
        this.spawnBoss(boss);
      }
    }

    // Despawn bosses that are out of proximity
    for (const [spawnId, _sprite] of this.bosses) {
      if (!currentBossIds.has(spawnId)) {
        this.logger.info('Despawning boss out of proximity:', { spawnId });
        this.despawnBoss(spawnId);
      }
    }
  }

  private spawnBoss(serverBoss: ServerSpawn): void {
    this.logger.info(`Starting to spawn boss: ${serverBoss.enemy} at (${serverBoss.x}, ${serverBoss.y}), state: ${serverBoss.state.tag}`);
    
    const sprite = this.createBossSprite(serverBoss);
    const isDead = serverBoss.state.tag === 'Dead';

    this.configureBossSprite(sprite, serverBoss);
    this.logger.info(`Boss sprite configured - scale: ${sprite.scale}, depth: ${sprite.depth}`);
    
    this.initializeBossAnimation(sprite, serverBoss.enemy, isDead);
    this.logger.info(`Boss animation initialized - isDead: ${isDead}, playing: ${sprite.anims?.isPlaying}, current anim: ${sprite.anims?.currentAnim?.key}`);
    
    this.configureBossPhysics(sprite, isDead);
    this.createBossHealthBar(serverBoss, sprite);
    // Note: Boss name is now shown in the full-width health bar, no separate name label needed
    this.registerBoss(sprite, serverBoss);

    this.logger.info(`Boss spawn completed: ${serverBoss.enemy} at (${serverBoss.x}, ${serverBoss.y}), visible: ${sprite.visible}`);
    
    // Emit spawn event for audio service
    this.scene.registry.events.emit('enemy:spawned', serverBoss.spawnId, serverBoss.enemy);
  }

  private createBossSprite(serverBoss: ServerSpawn): Phaser.Physics.Arcade.Sprite {
    // Use the enemy field as the sprite key (same textures as regular enemies)
    // Start at server y position but physics will make it fall to ground
    return this.scene.physics.add.sprite(serverBoss.x, serverBoss.y, serverBoss.enemy);
  }

  private configureBossSprite(sprite: Phaser.Physics.Arcade.Sprite, serverBoss: ServerSpawn): void {
    const { display } = ENEMY_CONFIG.boss;
    sprite.setOrigin(display.origin.x, display.origin.y);
    sprite.setScale(display.scale); // Larger scale for bosses
    sprite.setDepth(display.depth);
    sprite.clearTint();
    sprite.setBlendMode(Phaser.BlendModes.NORMAL);
    
    // Set initial facing direction
    if (serverBoss.facing.tag === 'Left') {
      sprite.setFlipX(true);
    } else if (serverBoss.facing.tag === 'Right') {
      sprite.setFlipX(false);
    }
  }

  private initializeBossAnimation(
    sprite: Phaser.Physics.Arcade.Sprite,
    bossType: string,
    isDead: boolean
  ): void {
    if (isDead) {
      // Set to last frame of death animation
      const deathFrames: Record<string, number> = {
        'orc-rider': 43, // Using same frame as orc for now
        // Add other boss types as needed
      };
      const deathFrame = deathFrames[bossType] ?? 0;
      if (deathFrame > 0) {
        sprite.setFrame(deathFrame);
      }
      sprite.setTint(0x666666);
      sprite.setAlpha(0.8);
      sprite.setDepth(ENEMY_CONFIG.boss.display.deadDepth);
    } else {
      // Play idle animation for alive bosses
      const idleAnimKey = `${bossType}-idle-anim`;
      if (sprite.anims && sprite.anims.exists(idleAnimKey)) {
        sprite.play(idleAnimKey);
      } else {
        this.logger.warn(`Idle animation '${idleAnimKey}' not found for boss type '${bossType}'`);
        // Set a default frame if animation doesn't exist
        sprite.setFrame(0);
      }
    }
  }

  private configureBossPhysics(sprite: Phaser.Physics.Arcade.Sprite, isDead: boolean): void {
    if (!sprite.body) return;

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    
    // Use same hitbox size as regular enemies (10x10) despite larger visual scale
    // This ensures consistent physics behavior
    body.setSize(10, 10);
    
    // Don't set offset - let Phaser handle it based on origin
    // This matches how regular enemies work
    
    body.setCollideWorldBounds(true);
    body.setImmovable(false); // Allow physics movement
    body.setVelocity(0, 0);
    
    // Enable gravity so boss falls to ground
    body.setGravityY(300); // Match enemy gravity
    body.setAllowGravity(true);

    if (isDead) {
      body.setEnable(false);
    }
  }

  private createBossHealthBar(serverBoss: ServerSpawn, _sprite: Phaser.Physics.Arcade.Sprite): void {
    // Get boss name from attributes
    let bossName = serverBoss.enemy;
    const bossConfig = bossAttributes.bosses[serverBoss.enemy];
    if (bossConfig && bossConfig.name) {
      bossName = bossConfig.name;
    }

    // Convert spawn_time to milliseconds for JavaScript Date
    // SpacetimeDB Timestamp is an object with __timestamp_micros_since_unix_epoch__ property
    let spawnTimeMs: number;
    
    try {
      let spawnTimeMicros: number;
      
      if (typeof serverBoss.spawnTime === 'object' && serverBoss.spawnTime !== null) {
        // SpacetimeDB Timestamp has __timestamp_micros_since_unix_epoch__ property (BigInt)
        const timestamp = serverBoss.spawnTime as any;
        spawnTimeMicros = Number(timestamp.__timestamp_micros_since_unix_epoch__);
      } else {
        spawnTimeMicros = Number(serverBoss.spawnTime);
      }
      
      // Check if conversion resulted in a valid number
      if (isNaN(spawnTimeMicros) || spawnTimeMicros === 0) {
        this.logger.warn(`Invalid spawn time for boss, using current time`, {
          spawnTimeType: typeof serverBoss.spawnTime,
          spawnTimeMicros
        });
        spawnTimeMs = Date.now();
      } else {
        spawnTimeMs = spawnTimeMicros / 1000; // Convert microseconds to milliseconds
        
        const elapsedMs = Date.now() - spawnTimeMs;
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        const remainingMinutes = 10 - elapsedMinutes;
        
        this.logger.info(`Boss spawn time:`, {
          spawnTimeMs,
          spawnTimeDate: new Date(spawnTimeMs).toISOString(),
          elapsedMinutes,
          remainingMinutes
        });
      }
    } catch (error) {
      this.logger.error(`Error converting spawn time, using current time:`, error);
      spawnTimeMs = Date.now();
    }

    const healthBar = new BossHealthBar(
      this.scene,
      bossName,
      serverBoss.maxHp,
      spawnTimeMs
    );

    healthBar.updateHealth(serverBoss.currentHp);
    this.bossHealthBars.set(serverBoss.spawnId, healthBar);
    
    // Show health bar immediately for bosses
    healthBar.show();
  }


  private registerBoss(sprite: Phaser.Physics.Arcade.Sprite, serverBoss: ServerSpawn): void {
    this.bossGroup.add(sprite);
    this.bosses.set(serverBoss.spawnId, sprite);
    this.bossStates.set(serverBoss.spawnId, serverBoss.state);

    // Create state machine for boss
    const stateMachine = new EnemyStateMachine(
      serverBoss.spawnId,
      sprite,
      serverBoss.enemy,
      this.scene,
      serverBoss.state
    );
    this.bossStateMachines.set(serverBoss.spawnId, stateMachine);

    // Set up landing detection for screen shake
    this.setupBossLandingDetection(sprite, serverBoss);
  }

  private isBossInProximity(serverBoss: ServerSpawn): boolean {
    // If not using proximity subscription, boss is always "in proximity"
    if (!this.subscriptionManager || !this.subscriptionManager.isProximityEnabled()) {
      return true;
    }

    // Check if boss is within proximity radius of player
    return this.subscriptionManager.isBossInProximity(serverBoss);
  }

  private setupBossLandingDetection(sprite: Phaser.Physics.Arcade.Sprite, serverBoss: ServerSpawn): void {
    // Only set up landing detection if boss is not dead and is spawning in the air
    if (serverBoss.state.tag === 'Dead' || !sprite.body) return;

    let hasLanded = false;
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    
    // Check if boss starts in the air (has gravity and will fall)
    if (body.allowGravity && body.velocity.y >= 0) {
      // Set up physics update to detect landing
      const checkLanding = () => {
        if (!hasLanded && body.blocked.down) {
          hasLanded = true;
          
          // Trigger subtle screen shake for boss impact
          const shakeDuration = 150; // 150ms for subtle effect
          const shakeIntensity = 0.005; // Very subtle intensity
          
          this.scene.cameras.main.shake(shakeDuration, shakeIntensity);
          this.logger.info(`Boss ${serverBoss.enemy} landed! Triggering screen shake.`);
          
          // Remove the update listener after landing
          this.scene.events.off('update', checkLanding);
        }
      };
      
      // Add update listener
      this.scene.events.on('update', checkLanding);
      
      // Clean up listener if sprite is destroyed
      sprite.once('destroy', () => {
        this.scene.events.off('update', checkLanding);
      });
    }
  }

  private updateBoss(serverBoss: ServerSpawn): void {
    const sprite = this.bosses.get(serverBoss.spawnId);
    const healthBar = this.bossHealthBars.get(serverBoss.spawnId);
    
    // Check if boss is within proximity before spawning
    const isInProximity = this.isBossInProximity(serverBoss);

    if (!sprite && isInProximity) {
      // Boss doesn't exist locally but is within proximity - spawn it
      this.logger.info(`Boss ${serverBoss.spawnId} entered proximity - spawning`);
      this.spawnBoss(serverBoss);
      return;
    }
    
    if (!sprite) return;
    
    // If boss exists but is out of proximity, despawn it
    if (!isInProximity) {
      this.logger.info(`Boss ${serverBoss.spawnId} out of proximity - despawning`);
      this.despawnBoss(serverBoss.spawnId);
      return;
    }

    // Update only x position - let physics handle y
    sprite.x = serverBoss.x;
    
    // Update sprite facing based on server data
    if (serverBoss.facing.tag === 'Left') {
      sprite.setFlipX(true);
    } else if (serverBoss.facing.tag === 'Right') {
      sprite.setFlipX(false);
    }
    
    // Update health bar (no position update needed for full-width bar)
    if (healthBar) {
      healthBar.updateHealth(serverBoss.currentHp);
    }

    // Boss name is now displayed in the full-width health bar

    // Check for state changes
    const previousState = this.bossStates.get(serverBoss.spawnId);
    const currentState = serverBoss.state;

    if (previousState?.tag !== currentState.tag) {
      this.logger.info(`Boss ${serverBoss.enemy} state change: ${previousState?.tag || 'unknown'} -> ${currentState.tag}`);
      this.handleStateChange(serverBoss.spawnId, currentState, serverBoss.enemy);
      this.bossStates.set(serverBoss.spawnId, currentState);

      // Hide health bar when boss dies
      if (currentState.tag === 'Dead' && healthBar) {
        healthBar.hide();
        // Emit death event for audio service
        this.scene.registry.events.emit('enemy:died', serverBoss.spawnId);
      }
    } else {
      // For attack states, check if animation has stopped playing and restart it
      // This handles the case where boss stays in attack state while being hit
      if (currentState.tag === 'Attack1' || currentState.tag === 'Attack2' || currentState.tag === 'Attack3') {
        const expectedAnim = `${serverBoss.enemy}-${currentState.tag.toLowerCase()}-anim`;
        if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== expectedAnim) {
          this.logger.info(`Boss ${serverBoss.enemy} restarting stuck attack animation: ${currentState.tag}`);
          sprite.play(expectedAnim);
        }
      }
    }

    // Handle animations based on boss state (same logic as regular enemies)
    if (currentState.tag === 'Walk') {
      // Boss is in walk state - play walk animation
      if (
        !sprite.anims.isPlaying ||
        sprite.anims.currentAnim?.key !== `${serverBoss.enemy}-walk-anim`
      ) {
        sprite.play(`${serverBoss.enemy}-walk-anim`);
      }
    } else if (currentState.tag === 'Idle') {
      // Boss is in idle state - play idle animation
      if (
        !sprite.anims.isPlaying ||
        sprite.anims.currentAnim?.key !== `${serverBoss.enemy}-idle-anim`
      ) {
        sprite.play(`${serverBoss.enemy}-idle-anim`);
      }
    }
  }

  private handleStateChange(bossSpawnId: number, newState: PlayerState, _bossType: string): void {
    const stateMachine = this.bossStateMachines.get(bossSpawnId);
    if (stateMachine) {
      stateMachine.handleServerStateChange(newState);
    }
    
    // Emit attack events for audio service
    if (newState.tag === 'Attack1') {
      this.scene.registry.events.emit('boss:attack', bossSpawnId, 1);
    } else if (newState.tag === 'Attack2') {
      this.scene.registry.events.emit('boss:attack', bossSpawnId, 2);
    } else if (newState.tag === 'Attack3') {
      this.scene.registry.events.emit('boss:attack', bossSpawnId, 3);
    }
  }

  private despawnBoss(bossSpawnId: number): void {
    const sprite = this.bosses.get(bossSpawnId);
    const healthBar = this.bossHealthBars.get(bossSpawnId);
    const stateMachine = this.bossStateMachines.get(bossSpawnId);

    if (sprite) {
      this.bossGroup.remove(sprite);
      if (sprite.body) {
        sprite.body.enable = false;
      }
      
      // Emit despawn event for audio service
      this.scene.registry.events.emit('enemy:despawned', bossSpawnId);

      // Fade out boss
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        duration: 2000,
        ease: 'Linear',
        onComplete: () => {
          sprite.destroy();
        },
      });

      this.bosses.delete(bossSpawnId);
    }

    if (healthBar) {
      healthBar.destroy();
      this.bossHealthBars.delete(bossSpawnId);
    }

    if (stateMachine) {
      stateMachine.destroy();
      this.bossStateMachines.delete(bossSpawnId);
    }

    this.bossStates.delete(bossSpawnId);
  }

  // Public API
  public getBossSprite(bossSpawnId: number): Phaser.Physics.Arcade.Sprite | null {
    return this.bosses.get(bossSpawnId) || null;
  }

  public getBossIdFromSprite(sprite: Phaser.Physics.Arcade.Sprite): number | null {
    for (const [bossSpawnId, bossSprite] of this.bosses) {
      if (bossSprite === sprite) {
        return bossSpawnId;
      }
    }
    return null;
  }

  public isBossDead(bossSprite: Phaser.Physics.Arcade.Sprite): boolean {
    const bossSpawnId = this.getBossIdFromSprite(bossSprite);
    if (bossSpawnId === null) return false;
    const state = this.bossStates.get(bossSpawnId);
    return state?.tag === 'Dead';
  }

  public canBossTakeDamage(bossSpawnId: number): boolean {
    const state = this.bossStates.get(bossSpawnId);
    return state !== undefined && state.tag !== 'Dead';
  }

  public canBossDamagePlayer(bossSpawnId: number): boolean {
    const state = this.bossStates.get(bossSpawnId);
    // Boss can damage player if it's alive (not dead)
    return state !== undefined && state.tag !== 'Dead';
  }

  public playHitAnimation(bossSpawnId: number): void {
    const stateMachine = this.bossStateMachines.get(bossSpawnId);
    if (stateMachine) {
      stateMachine.playHitAnimation();
    }
  }

  public getBossGroup(): Phaser.Physics.Arcade.Group {
    return this.bossGroup;
  }

  // PhysicsEntity implementation
  public setupPhysics(registry: PhysicsRegistry): void {
    const bossGroup = this.getBossGroup();
    
    // Register boss group with registry
    registry.registerGroup('bosses', bossGroup);
    
    // Set up boss collisions
    registry.addGroupCollider('bosses', 'ground');
    registry.addGroupCollider('bosses', 'platforms', undefined, registry.createOneWayPlatformCallback());
    registry.addGroupCollider('bosses', 'boundaries');
  }

  public destroy(): void {
    this.bosses.forEach((sprite) => sprite.destroy());
    this.bossHealthBars.forEach((healthBar) => healthBar.destroy());
    this.bossStateMachines.forEach((stateMachine) => stateMachine.destroy());
    this.bosses.clear();
    this.bossHealthBars.clear();
    this.bossStateMachines.clear();
    this.bossNameLabels.clear(); // Keep the clear for backwards compatibility
    this.bossGroup.destroy();
    this.bossStates.clear();
    this.subscriptionManager.destroy();
  }
}