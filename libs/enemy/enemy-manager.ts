import Phaser from 'phaser';
import { DbConnection, Enemy as ServerEnemy, PlayerState } from '@/spacetime/client';
import { EnemyStateManager } from './state/enemy-state-service';
import { EnemySpawnManager } from './managers/enemy-spawn-manager';
import { EnemyMovementManager } from './managers/enemy-movement-manager';
import {
  EnemySubscriptionManager,
  type EnemySubscriptionConfig,
} from './managers/enemy-subscription-manager';
import { createLogger } from '@/core/logger';
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
  private handleEnemyDelete(enemyId: number): void {
    this.despawnServerEnemy(enemyId);
  }

  /**
   * Handle proximity load of multiple enemies
   */
  private handleProximityLoad(enemies: ServerEnemy[]): void {
    const currentEnemyIds = new Set<number>();

    // Spawn enemies that are within proximity
    for (const enemy of enemies) {
      currentEnemyIds.add(enemy.enemyId);
      if (!this.spawnManager.getEnemy(enemy.enemyId)) {
        this.spawnServerEnemy(enemy);
      }
    }

    // Remove enemies that are no longer in proximity
    for (const [enemyId] of this.spawnManager.getEnemies()) {
      if (!currentEnemyIds.has(enemyId)) {
        this.despawnServerEnemy(enemyId);
      }
    }
  }

  private spawnServerEnemy(serverEnemy: ServerEnemy): void {
    const sprite = this.spawnManager.spawnEnemy(serverEnemy);

    // Track enemy state and type
    this.enemyStates.set(serverEnemy.enemyId, serverEnemy.state);
    this.enemyTypes.set(serverEnemy.enemyId, serverEnemy.enemyType);

    // Register movement interpolation callback
    this.movementManager.registerInterpolationCallback(serverEnemy.enemyId, (x: number) => {
      sprite.setX(x);
      const healthBar = this.spawnManager.getHealthBar(serverEnemy.enemyId);
      if (healthBar) {
        healthBar.updatePosition(x, sprite.y);
      }
    });
  }

  private despawnServerEnemy(enemyId: number): void {
    // Clean up movement interpolation
    this.movementManager.unregisterInterpolationCallback(enemyId);

    // Clean up state tracking
    this.enemyStates.delete(enemyId);
    this.enemyTypes.delete(enemyId);

    // Despawn the enemy
    this.spawnManager.despawnEnemy(enemyId);
  }

  private updateServerEnemy(serverEnemy: ServerEnemy): void {
    const sprite = this.spawnManager.getEnemy(serverEnemy.enemyId);
    const healthBar = this.spawnManager.getHealthBar(serverEnemy.enemyId);
    
    // Check proximity if using proximity subscription
    const isInProximity = this.subscriptionManager.isEnemyInProximity(serverEnemy);
    
    if (!sprite && isInProximity) {
      // Enemy doesn't exist locally but is within proximity - spawn it
      this.logger.debug(`Enemy ${serverEnemy.enemyId} entered proximity - spawning`);
      this.spawnServerEnemy(serverEnemy);
      return;
    }
    
    if (!sprite) return;

    if (!isInProximity) {
      this.despawnServerEnemy(serverEnemy.enemyId);
      return;
    }

    // Update position and movement
    const previousX = this.movementManager.updateEnemyPosition(serverEnemy, sprite, healthBar);

    // Check for state changes
    const previousState = this.enemyStates.get(serverEnemy.enemyId);
    const currentState = serverEnemy.state;

    if (previousState?.tag !== currentState.tag) {
      this.handleStateChange(serverEnemy.enemyId, currentState, serverEnemy.enemyType);
      this.enemyStates.set(serverEnemy.enemyId, currentState);

      // Hide health bar when enemy dies
      if (currentState.tag === 'Dead' && healthBar) {
        healthBar.hide();
      }
    }

    // Handle movement animation for idle enemies (patrol movement)
    if (currentState.tag === 'Idle') {
      const isMoving = this.movementManager.isEnemyMoving(
        serverEnemy.enemyId,
        previousX,
        serverEnemy.x
      );

      if (isMoving) {
        // Enemy is moving - play walk animation
        if (
          !sprite.anims.isPlaying ||
          sprite.anims.currentAnim?.key !== `${serverEnemy.enemyType}-walk-anim`
        ) {
          sprite.play(`${serverEnemy.enemyType}-walk-anim`);
        }
      } else {
        // Enemy is not moving - play idle animation
        if (
          !sprite.anims.isPlaying ||
          sprite.anims.currentAnim?.key !== `${serverEnemy.enemyType}-idle-anim`
        ) {
          sprite.play(`${serverEnemy.enemyType}-idle-anim`);
        }
      }
    }

    // Clear any tint - enemies maintain their natural color
    sprite.clearTint();
  }

  private handleStateChange(enemyId: number, newState: PlayerState, _enemyType: string): void {
    // Use state machine to handle state changes
    const stateMachine = this.spawnManager.getStateMachine(enemyId);
    if (stateMachine) {
      stateMachine.handleServerStateChange(newState);
    }
  }

  // Public API methods
  public playHitAnimation(enemyId: number): void {
    const stateMachine = this.spawnManager.getStateMachine(enemyId);
    if (stateMachine) {
      stateMachine.playHitAnimation();
    }
  }

  public getEnemyIdFromSprite(sprite: Phaser.Physics.Arcade.Sprite): number | null {
    for (const [enemyId, enemySprite] of this.spawnManager.getEnemies()) {
      if (enemySprite === sprite) {
        return enemyId;
      }
    }
    return null;
  }

  public getEnemySprite(enemyId: number): Phaser.Physics.Arcade.Sprite | null {
    return this.spawnManager.getEnemy(enemyId) || null;
  }

  public isEnemyDead(enemySprite: Phaser.Physics.Arcade.Sprite): boolean {
    const enemyId = this.getEnemyIdFromSprite(enemySprite);
    if (enemyId === null) return false;
    return this.stateService.isEnemyDead(enemyId);
  }

  public canEnemyTakeDamage(enemyId: number): boolean {
    return this.stateService.canEnemyTakeDamage(enemyId);
  }

  public canEnemyDamagePlayer(enemyId: number): boolean {
    return this.stateService.canEnemyDamagePlayer(enemyId);
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
