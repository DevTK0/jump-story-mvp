import Phaser from 'phaser';
import { Player } from '@/player';
import { onSceneEvent } from '@/core/scene';
import { AnimationSystem } from '@/player/animations';
import { AttackType } from '@/spacetime/client';
import { PlayerQueryService } from '@/player';
import { createLogger } from '@/core/logger';
import type {
  DatabaseConnection,
  AttackHitbox,
  EnemySprite,
  PlayerSprite,
  KnockbackDirection,
  InteractionCallbacks,
  InteractionEnemyManager,
} from './interaction-interfaces';

export interface InteractionConfig {
  cameraShakeDuration?: number;
  cameraShakeIntensity?: number;
}

export class InteractionHandler {
  private scene: Phaser.Scene;
  private dbConnection: DatabaseConnection | null;
  private currentAttackType: number = 1; // Default to attack1
  private enemyManager: InteractionEnemyManager | null = null;
  private playerQueryService: PlayerQueryService | null = null;
  private logger = createLogger('InteractionHandler');

  // Track enemies damaged in current attack to prevent duplicates
  private damagedInCurrentAttack = new Set<number>();

  constructor(
    scene: Phaser.Scene,
    dbConnection: DatabaseConnection | null,
    _config?: InteractionConfig
  ) {
    this.scene = scene;
    this.dbConnection = dbConnection;

    // Get PlayerQueryService singleton if available
    this.playerQueryService = PlayerQueryService.getInstance();

    // Listen for player attack events to track current attack type
    onSceneEvent(this.scene, 'player:attacked', (data) => {
      this.currentAttackType = data.attackType || 1;
      // Clear damage tracking for new attack
      this.damagedInCurrentAttack.clear();
    });
  }

  /**
   * Handle when player's attack hits an enemy
   */
  public handleAttackHitEnemy(
    enemyManager: InteractionEnemyManager
  ): (_hitbox: AttackHitbox, enemy: EnemySprite) => void {
    return (_hitbox: AttackHitbox, enemy: EnemySprite) => {
      // Don't allow attacks if player is dead
      if (this.isPlayerDead()) {
        this.logger.debug('Prevented attack - player is dead');
        return;
      }

      // Get enemy ID first to use centralized validation
      const enemyId = enemyManager.getEnemyIdFromSprite(enemy);
      if (enemyId === null) {
        this.logger.debug('Prevented attack - enemy ID not found');
        return;
      }

      // Use centralized state service validation
      if (!enemyManager.canEnemyTakeDamage(enemyId)) {
        return;
      }

      // Prevent multiple damage to same enemy in single attack
      if (this.damagedInCurrentAttack.has(enemyId)) {
        this.logger.debug('Prevented duplicate damage to enemy', enemyId);
        return;
      }

      // Mark enemy as damaged in this attack
      this.damagedInCurrentAttack.add(enemyId);

      // Visual feedback for successful hit
      // Screen shake disabled
      // this.scene.cameras.main.shake(
      //     this.config.cameraShakeDuration,
      //     this.config.cameraShakeIntensity
      // );

      // Damage enemy (hit animation will be handled by DamageEvent subscription)
      this.logger.info('Enemy hit!', enemyId);

      // Call server reducer to damage enemy
      if (this.dbConnection && this.dbConnection.reducers) {
        const attackType = this.mapAttackTypeToEnum(this.currentAttackType);
        this.dbConnection.reducers.damageEnemy(enemyId, attackType);
      } else {
        this.logger.warn('Database connection not available - cannot damage enemy');
      }
    };
  }

  /**
   * Handle when player touches an enemy (takes damage)
   */
  public handlePlayerTouchEnemy(
    player: Player
  ): (playerSprite: PlayerSprite, enemy: EnemySprite) => void {
    return (playerSprite: PlayerSprite, enemy: EnemySprite) => {
      // Don't allow any interactions with dead players
      if (this.isPlayerDead()) {
        this.logger.debug('Prevented enemy interaction - player is dead');
        return;
      }

      // Check for invulnerability from scene config
      const sceneConfig = player.scene.data.get('sceneConfig') as any;
      if (sceneConfig?.debug?.invulnerable) {
        this.logger.debug('Prevented damage - player is invulnerable (debug mode)');
        return;
      }

      // Debug: Log enemy physics body state
      this.logger.debug(
        'Enemy collision - body exists:',
        !!enemy.body,
        'body enabled:',
        enemy.body?.enable
      );

      // Use centralized validation if enemy manager is available
      if (this.enemyManager) {
        const enemyId = this.enemyManager.getEnemyIdFromSprite(enemy);
        if (enemyId !== null && !this.enemyManager.canEnemyDamagePlayer(enemyId)) {
          this.logger.debug('Prevented damage from invalid/dead enemy');
          return;
        }
      } else {
        // Fallback: Check if enemy physics body is disabled (dead enemies have disabled bodies)
        if (!enemy.body || !enemy.body.enable) {
          this.logger.debug('Prevented damage from dead enemy (physics check)');
          return;
        }
      }

      // Calculate knockback direction (away from enemy)
      const knockbackDirection = this.calculateKnockbackDirection(playerSprite, enemy);

      // Get the animation system and check/trigger damaged animation with knockback
      const animationSystem = player.getSystem<AnimationSystem>('animations');
      if (animationSystem && animationSystem.playDamagedAnimation) {
        // Check invulnerability state before processing damage
        this.logger.debug(
          `🔍 Damage attempt - Player invulnerable: ${animationSystem.isPlayerInvulnerable()}`
        );

        // Only trigger damaged if not already invulnerable
        const wasDamaged = animationSystem.playDamagedAnimation(knockbackDirection);
        if (wasDamaged) {
          this.logger.info(
            '✅ Player damaged by enemy! Sending damage to server. Knockback direction:',
            knockbackDirection
          );

          // Call server reducer to damage player
          if (this.dbConnection && this.dbConnection.reducers && this.enemyManager) {
            const enemyId = this.enemyManager.getEnemyIdFromSprite(enemy);
            if (enemyId !== null) {
              this.logger.debug('📡 Sending damage to server for enemy:', enemyId);
              this.dbConnection.reducers.playerTakeDamage(enemyId);
            }
          } else {
            this.logger.warn('Database connection not available - cannot damage player');
          }
        } else {
          this.logger.debug(
            '❌ Damage attempt blocked - player invulnerable or animation system rejected'
          );
        }
      }
    };
  }

  /**
   * Calculate knockback direction from enemy to player
   */
  private calculateKnockbackDirection(
    player: PlayerSprite,
    enemy: EnemySprite
  ): KnockbackDirection {
    const playerPos = { x: player.x, y: player.y };
    const enemyPos = { x: enemy.x, y: enemy.y };

    // Calculate direction from enemy to player (away from enemy)
    const deltaX = playerPos.x - enemyPos.x;
    const deltaY = playerPos.y - enemyPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Normalize direction (prevent division by zero)
    return {
      x: distance > 0 ? deltaX / distance : 1, // Default right if same position
      y: distance > 0 ? deltaY / distance : 0,
    };
  }

  /**
   * Map numeric attack type to AttackType enum
   */
  private mapAttackTypeToEnum(attackType: number): AttackType {
    switch (attackType) {
      case 1:
        return { tag: 'Attack1' };
      case 2:
        return { tag: 'Attack2' };
      case 3:
        return { tag: 'Attack3' };
      default:
        return { tag: 'Attack1' }; // Default fallback
    }
  }

  /**
   * Set up all interaction callbacks at once
   */
  public createInteractionCallbacks(
    player: Player,
    enemyManager: InteractionEnemyManager
  ): InteractionCallbacks {
    return {
      onAttackHitEnemy: this.handleAttackHitEnemy(enemyManager),
      onPlayerTouchEnemy: this.handlePlayerTouchEnemy(player),
    };
  }

  /**
   * Update the database connection when it becomes available
   */
  public setDbConnection(dbConnection: DatabaseConnection | null): void {
    this.dbConnection = dbConnection;

    // Get the singleton PlayerQueryService (should already be initialized by PlaygroundScene)
    this.playerQueryService = PlayerQueryService.getInstance();
    if (!this.playerQueryService) {
      this.logger.warn('⚠️ InteractionHandler: PlayerQueryService singleton not available');
    }
  }

  /**
   * Set reference to enemy manager for state checking
   */
  public setEnemyManager(enemyManager: InteractionEnemyManager | null): void {
    this.enemyManager = enemyManager;
  }

  /**
   * Check if the current player is dead on the server
   */
  private isPlayerDead(): boolean {
    // Use optimized PlayerQueryService instead of manual iteration
    if (!this.playerQueryService) {
      this.logger.warn(
        '⚠️ InteractionHandler: PlayerQueryService not available, assuming player alive'
      );
      return false;
    }

    return this.playerQueryService.isCurrentPlayerDead();
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    // Scene events are automatically cleaned up when scene is destroyed
  }
}
