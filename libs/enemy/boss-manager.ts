import Phaser from 'phaser';
import { DbConnection, Spawn as ServerSpawn, PlayerState, EnemyType } from '@/spacetime/client';
import { createLogger } from '@/core/logger';
import { ENEMY_CONFIG } from './config/enemy-config';
import { BossHealthBar } from './ui/boss-health-bar';
import { EnemyStateMachine } from './state/enemy-state-machine';
import { bossAttributes } from '../../apps/playground/config/enemy-attributes';
import type { PhysicsEntity } from '@/core/physics/physics-entity';
import type { PhysicsRegistry } from '@/core/physics/physics-registry';

/**
 * Manages boss entities - larger, more powerful enemies with global visibility
 */
export class BossManager implements PhysicsEntity {
  private scene: Phaser.Scene;
  private logger = createLogger('BossManager');
  private dbConnection: DbConnection | null = null;

  // Boss tracking
  private bosses = new Map<number, Phaser.Physics.Arcade.Sprite>();
  private bossHealthBars = new Map<number, BossHealthBar>();
  private bossStateMachines = new Map<number, EnemyStateMachine>();
  private bossNameLabels = new Map<number, Phaser.GameObjects.Text>();
  private bossGroup: Phaser.Physics.Arcade.Group;
  private bossStates = new Map<number, PlayerState>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bossGroup = this.scene.physics.add.group();
  }

  public setDbConnection(connection: DbConnection): void {
    this.logger.info('Setting database connection');
    this.dbConnection = connection;
    
    // Log connection state
    if (connection) {
      this.logger.info('Connection established, checking spawn table for bosses...');
      try {
        const allSpawnCount = connection.db.spawn.count();
        const bossCount = Array.from(connection.db.spawn.iter()).filter(spawn => spawn.enemyType.tag === 'Boss').length;
        this.logger.info(`Spawn table count: ${allSpawnCount}, Boss count: ${bossCount}`);
      } catch (error) {
        this.logger.error('Error accessing spawn table:', error);
      }
    }
    
    this.subscribeToBosses();
  }

  /**
   * Subscribe to boss spawn events globally (not proximity-based)
   * Uses unified Spawn table filtering for boss type
   */
  private subscribeToBosses(): void {
    if (!this.dbConnection) return;

    this.logger.info('Setting up boss subscriptions...');

    // Subscribe to spawn table changes, filtering for bosses
    const onInsert = (ctx: any, spawn: ServerSpawn) => {
      if (spawn.enemyType.tag === 'Boss') {
        this.logger.info('Boss insert event received:', { enemy: spawn.enemy, position: { x: spawn.x, y: spawn.y } });
        this.handleBossInsert(spawn, ctx);
      }
    };
    const onDelete = (_ctx: any, spawn: ServerSpawn) => {
      if (spawn.enemyType.tag === 'Boss') {
        this.logger.info('Boss delete event received:', { enemy: spawn.enemy });
        this.handleBossDelete(spawn);
      }
    };
    const onUpdate = (_ctx: any, oldSpawn: ServerSpawn, newSpawn: ServerSpawn) => {
      if (newSpawn.enemyType.tag === 'Boss') {
        this.logger.info('Boss update event received:', { enemy: newSpawn.enemy, position: { x: newSpawn.x, y: newSpawn.y } });
        this.handleBossUpdate(oldSpawn, newSpawn);
      }
    };

    this.dbConnection.db.spawn.onInsert(onInsert);
    this.dbConnection.db.spawn.onDelete(onDelete);
    this.dbConnection.db.spawn.onUpdate(onUpdate);

    // Spawn existing bosses that are already in the database
    const existingBosses = Array.from(this.dbConnection.db.spawn.iter()).filter(spawn => spawn.enemyType.tag === 'Boss');
    this.logger.info(`Found ${existingBosses.length} existing bosses in spawn table`);
    
    for (const boss of existingBosses) {
      this.logger.info('Spawning existing boss:', { enemy: boss.enemy, position: { x: boss.x, y: boss.y }, state: boss.state.tag });
      this.spawnBoss(boss);
    }
    
    // Check again after a delay in case data hasn't synced yet
    this.scene.time.delayedCall(1000, () => {
      const delayedBosses = Array.from(this.dbConnection!.db.spawn.iter()).filter(spawn => spawn.enemyType.tag === 'Boss');
      this.logger.info(`Delayed check: Found ${delayedBosses.length} bosses in spawn table`);
      
      // Spawn any bosses we missed
      for (const boss of delayedBosses) {
        if (!this.bosses.has(boss.spawnId)) {
          this.logger.info('Spawning missed boss:', { enemy: boss.enemy, position: { x: boss.x, y: boss.y } });
          this.spawnBoss(boss);
        }
      }
    });
  }

  private handleBossInsert(boss: ServerSpawn, reducerEvent: any): void {
    if (reducerEvent) {
      this.logger.info('Boss spawned from reducer:', reducerEvent);
    }
    this.spawnBoss(boss);
  }

  private handleBossUpdate(oldBoss: ServerSpawn, newBoss: ServerSpawn): void {
    this.updateBoss(newBoss);
  }

  private handleBossDelete(boss: ServerSpawn): void {
    this.despawnBoss(boss.spawnId);
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

  private createBossHealthBar(serverBoss: ServerSpawn, sprite: Phaser.Physics.Arcade.Sprite): void {
    // Get boss name from attributes
    let bossName = serverBoss.enemy;
    const bossConfig = bossAttributes.bosses[serverBoss.enemy];
    if (bossConfig && bossConfig.name) {
      bossName = bossConfig.name;
    }

    const healthBar = new BossHealthBar(
      this.scene,
      bossName,
      serverBoss.maxHp
    );

    healthBar.updateHealth(serverBoss.currentHp);
    this.bossHealthBars.set(serverBoss.spawnId, healthBar);
  }

  private createBossNameLabel(serverBoss: ServerSpawn, sprite: Phaser.Physics.Arcade.Sprite): void {
    // Get boss name from attributes
    let bossName = serverBoss.enemy;
    const bossConfig = bossAttributes.bosses[serverBoss.enemy];
    if (bossConfig && bossConfig.name) {
      bossName = bossConfig.name;
    }

    const nameLabel = this.scene.add.text(
      sprite.x,
      sprite.y + ENEMY_CONFIG.boss.nameLabel.offsetY,
      bossName,
      {
        fontSize: ENEMY_CONFIG.boss.nameLabel.fontSize,
        color: ENEMY_CONFIG.boss.nameLabel.color,
        stroke: ENEMY_CONFIG.boss.nameLabel.stroke,
        strokeThickness: ENEMY_CONFIG.boss.nameLabel.strokeThickness,
      }
    );

    nameLabel.setOrigin(0.5, 0.5);
    nameLabel.setDepth(ENEMY_CONFIG.boss.nameLabel.depth);

    this.bossNameLabels.set(serverBoss.spawnId, nameLabel);
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
  }

  private updateBoss(serverBoss: ServerSpawn): void {
    const sprite = this.bosses.get(serverBoss.spawnId);
    const healthBar = this.bossHealthBars.get(serverBoss.spawnId);

    if (!sprite) {
      // Boss doesn't exist locally - spawn it
      this.spawnBoss(serverBoss);
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
  }
}