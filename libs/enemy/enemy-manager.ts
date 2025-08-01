import Phaser from 'phaser';
import { DbConnection, Spawn as ServerEnemy, PlayerState } from '@/spacetime/client';
import { EnemyStateManager } from './state/enemy-state-service';
import { EnemySpawnManager } from './managers/enemy-spawn-manager';
import { EnemyMovementManager } from './managers/enemy-movement-manager';
import {
  EnemySubscriptionManager,
  type EnemySubscriptionConfig,
} from './managers/enemy-subscription-manager';
import { createLogger } from '@/core/logger';
import { ENEMY_CONFIG } from './config/enemy-config';
import type { PhysicsEntity } from '@/core/physics/physics-entity';
import type { PhysicsRegistry } from '@/core/physics/physics-registry';

/**
 * Refactored EnemyManager - orchestrates enemy subsystems
 * Delegates specific responsibilities to focused managers
 */
export class EnemyManager implements PhysicsEntity {
  private scene: Phaser.Scene;
  private logger = createLogger('EnemyManager');

  // Subsystem managers
  private spawnManager: EnemySpawnManager;
  private movementManager: EnemyMovementManager;
  private subscriptionManager: EnemySubscriptionManager;
  private stateService: EnemyStateManager;

  // State tracking
  private enemyStates = new Map<number, PlayerState>();
  private enemyTypes = new Map<number, string>();
  private attackedEnemies = new Set<number>(); // Track which enemies have been attacked

  constructor(scene: Phaser.Scene, subscriptionConfig?: Partial<EnemySubscriptionConfig>) {
    this.scene = scene;

    // Initialize subsystems
    this.spawnManager = new EnemySpawnManager(scene);
    this.movementManager = new EnemyMovementManager(scene);
    this.stateService = new EnemyStateManager(this.spawnManager.getEnemies(), this.enemyStates);

    // Initialize subscription manager with callbacks
    this.subscriptionManager = new EnemySubscriptionManager(
      scene,
      {
        onEnemyInsert: this.handleEnemyInsert.bind(this),
        onEnemyUpdate: this.handleEnemyUpdate.bind(this),
        onEnemyDelete: this.handleEnemyDelete.bind(this),
        onProximityLoad: this.handleProximityLoad.bind(this),
      },
      subscriptionConfig
    );

    this.verifyEnemyAnimations();
  }

  public setDbConnection(connection: DbConnection): void {
    this.subscriptionManager.setDbConnection(connection);
    this.spawnManager.setDbConnection(connection);
  }

  private verifyEnemyAnimations(): void {
    // Verify animations exist (they should be created at scene level)
    if (!this.scene.anims.exists('orc-idle-anim')) {
      this.logger.warn('Enemy animations not found! They should be created at scene level.');
    }
  }

  /**
   * Handle enemy insertion from server
   */
  private handleEnemyInsert(serverEnemy: ServerEnemy): void {
    this.spawnServerEnemy(serverEnemy);
  }

  /**
   * Handle enemy update from server
   */
  private handleEnemyUpdate(serverEnemy: ServerEnemy): void {
    this.updateServerEnemy(serverEnemy);
  }

  /**
   * Handle enemy deletion from server
   */
  private handleEnemyDelete(spawnId: number): void {
    this.despawnServerEnemy(spawnId);
  }

  /**
   * Handle proximity load of multiple enemies
   */
  private handleProximityLoad(enemies: ServerEnemy[]): void {
    const currentEnemyIds = new Set<number>();

    // Spawn enemies that are within proximity
    for (const enemy of enemies) {
      currentEnemyIds.add(enemy.spawnId);
      if (!this.spawnManager.getEnemy(enemy.spawnId)) {
        this.spawnServerEnemy(enemy);
      }
    }

    // Remove enemies that are no longer in proximity
    for (const [spawnId] of this.spawnManager.getEnemies()) {
      if (!currentEnemyIds.has(spawnId)) {
        this.despawnServerEnemy(spawnId);
      }
    }
  }

  private spawnServerEnemy(serverEnemy: ServerEnemy): void {
    
    const sprite = this.spawnManager.spawnEnemy(serverEnemy);

    // Track enemy state and type
    this.enemyStates.set(serverEnemy.spawnId, serverEnemy.state);
    this.enemyTypes.set(serverEnemy.spawnId, serverEnemy.enemy);
    
    // Mark enemy as spawned in registry for proximity buffer zone
    this.scene.registry.set(`enemy_spawned_${serverEnemy.spawnId}`, true);
    
    // Check if this enemy was already attacked (handle race condition)
    if (this.attackedEnemies.has(serverEnemy.spawnId)) {
      this.spawnManager.showNameLabel(serverEnemy.spawnId);
      this.spawnManager.showHealthBar(serverEnemy.spawnId);
    }
    
    // Emit spawn event for audio service
    this.scene.registry.events.emit('enemy:spawned', serverEnemy.spawnId, serverEnemy.enemy);

    // Register movement interpolation callback
    this.movementManager.registerInterpolationCallback(serverEnemy.spawnId, (x: number) => {
      sprite.setX(x);
      const healthBar = this.spawnManager.getHealthBar(serverEnemy.spawnId);
      if (healthBar) {
        healthBar.updatePosition(x, sprite.y);
      }
      const nameLabel = this.spawnManager.getNameLabel(serverEnemy.spawnId);
      if (nameLabel) {
        nameLabel.setPosition(x, sprite.y + ENEMY_CONFIG.nameLabel.offsetY);
      }
    });
  }

  private despawnServerEnemy(spawnId: number): void {
    // Clean up movement interpolation
    this.movementManager.unregisterInterpolationCallback(spawnId);

    // Clean up state tracking
    this.enemyStates.delete(spawnId);
    this.enemyTypes.delete(spawnId);
    this.attackedEnemies.delete(spawnId); // Clear attacked state for respawn
    
    // Clear spawned flag from registry
    this.scene.registry.remove(`enemy_spawned_${spawnId}`);
    
    // Emit despawn event for audio service
    this.scene.registry.events.emit('enemy:despawned', spawnId);

    // Despawn the enemy
    this.spawnManager.despawnEnemy(spawnId);
  }

  private updateServerEnemy(serverEnemy: ServerEnemy): void {
    const sprite = this.spawnManager.getEnemy(serverEnemy.spawnId);
    const healthBar = this.spawnManager.getHealthBar(serverEnemy.spawnId);
    const nameLabel = this.spawnManager.getNameLabel(serverEnemy.spawnId);
    
    // Check proximity if using proximity subscription
    const isInProximity = this.subscriptionManager.isEnemyInProximity(serverEnemy);
    
    if (!sprite && isInProximity) {
      // Enemy doesn't exist locally but is within proximity - spawn it
      this.logger.debug(`Enemy ${serverEnemy.spawnId} entered proximity - spawning`);
      this.spawnServerEnemy(serverEnemy);
      return;
    }
    
    if (!sprite) return;

    if (!isInProximity) {
      this.despawnServerEnemy(serverEnemy.spawnId);
      return;
    }

    // Update position and movement
    const previousX = this.movementManager.updateEnemyPosition(serverEnemy, sprite, healthBar, nameLabel);

    // Check for state changes
    const previousState = this.enemyStates.get(serverEnemy.spawnId);
    const currentState = serverEnemy.state;

    if (previousState?.tag !== currentState.tag) {
      this.handleStateChange(serverEnemy.spawnId, currentState, serverEnemy.enemy);
      this.enemyStates.set(serverEnemy.spawnId, currentState);

      // Hide health bar when enemy dies
      if (currentState.tag === 'Dead' && healthBar) {
        healthBar.hide();
        // Emit death event for audio service
        this.scene.registry.events.emit('enemy:died', serverEnemy.spawnId);
      }
    }

    // Handle animations based on enemy state
    if (currentState.tag === 'Walk') {
      // Enemy is in walk state - play walk animation
      if (
        !sprite.anims.isPlaying ||
        sprite.anims.currentAnim?.key !== `${serverEnemy.enemy}-walk-anim`
      ) {
        sprite.play(`${serverEnemy.enemy}-walk-anim`);
      }
    } else if (currentState.tag === 'Idle') {
      // Enemy is in idle state - but check if actually moving (for backward compatibility)
      const isMoving = this.movementManager.isEnemyMoving(
        serverEnemy.spawnId,
        previousX,
        serverEnemy.x
      );

      if (isMoving) {
        // Enemy is moving but server hasn't updated to walk state yet - play walk animation
        if (
          !sprite.anims.isPlaying ||
          sprite.anims.currentAnim?.key !== `${serverEnemy.enemy}-walk-anim`
        ) {
          sprite.play(`${serverEnemy.enemy}-walk-anim`);
        }
      } else {
        // Enemy is not moving - play idle animation
        if (
          !sprite.anims.isPlaying ||
          sprite.anims.currentAnim?.key !== `${serverEnemy.enemy}-idle-anim`
        ) {
          sprite.play(`${serverEnemy.enemy}-idle-anim`);
        }
      }
    }

    // Clear any tint - enemies maintain their natural color
    sprite.clearTint();
  }

  private handleStateChange(spawnId: number, newState: PlayerState, _enemyType: string): void {
    // Use state machine to handle state changes
    const stateMachine = this.spawnManager.getStateMachine(spawnId);
    if (stateMachine) {
      stateMachine.handleServerStateChange(newState);
    }
  }

  // Public API methods
  public playHitAnimation(spawnId: number): void {
    const stateMachine = this.spawnManager.getStateMachine(spawnId);
    if (stateMachine) {
      stateMachine.playHitAnimation();
    }
  }

  public markEnemyAsAttacked(spawnId: number): void {
    if (!this.attackedEnemies.has(spawnId)) {
      this.attackedEnemies.add(spawnId);
      this.spawnManager.showNameLabel(spawnId);
      this.spawnManager.showHealthBar(spawnId);
    }
  }

  public getEnemyIdFromSprite(sprite: Phaser.Physics.Arcade.Sprite): number | null {
    for (const [spawnId, enemySprite] of this.spawnManager.getEnemies()) {
      if (enemySprite === sprite) {
        return spawnId;
      }
    }
    return null;
  }

  public getEnemySprite(spawnId: number): Phaser.Physics.Arcade.Sprite | null {
    return this.spawnManager.getEnemy(spawnId) || null;
  }

  public isEnemyDead(enemySprite: Phaser.Physics.Arcade.Sprite): boolean {
    const spawnId = this.getEnemyIdFromSprite(enemySprite);
    if (spawnId === null) return false;
    return this.stateService.isEnemyDead(spawnId);
  }

  public canEnemyTakeDamage(spawnId: number): boolean {
    return this.stateService.canEnemyTakeDamage(spawnId);
  }

  public canEnemyDamagePlayer(spawnId: number): boolean {
    return this.stateService.canEnemyDamagePlayer(spawnId);
  }

  public getEnemyGroup(): Phaser.Physics.Arcade.Group {
    return this.spawnManager.getEnemyGroup();
  }

  // PhysicsEntity implementation
  public setupPhysics(registry: PhysicsRegistry): void {
    const enemyGroup = this.getEnemyGroup();
    
    // Register enemy group with registry for other entities to reference
    registry.registerGroup('enemies', enemyGroup);
    
    // Set up enemy collisions with world
    registry.addGroupCollider('enemies', 'ground');
    registry.addGroupCollider('enemies', 'platforms', undefined, registry.createOneWayPlatformCallback());
    registry.addGroupCollider('enemies', 'boundaries');
    
    // Note: Enemy-player and enemy-attack collisions will be set up by
    // InteractionHandler and CombatSystem respectively
  }

  public destroy(): void {
    this.spawnManager.destroy();
    this.movementManager.destroy();
    this.subscriptionManager.destroy();
    this.enemyStates.clear();
    this.enemyTypes.clear();
  }
}
