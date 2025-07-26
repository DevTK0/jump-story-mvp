import Phaser from 'phaser';
import { Player } from '@/player';
import { EnemyManager } from '@/enemy';

export interface CollisionGroups {
  ground: Phaser.Physics.Arcade.StaticGroup;
  platforms: Phaser.Physics.Arcade.StaticGroup;
  climbeable: Phaser.Physics.Arcade.StaticGroup;
  boundaries: Phaser.Physics.Arcade.StaticGroup;
}

export class PhysicsConfigurator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set up all collisions for the player
   */
  public setupPlayerCollisions(
    player: Player,
    groups: CollisionGroups,
    climbingSystem?: any
  ): void {
    // Add collision between player and ground (traditional solid collision)
    this.scene.physics.add.collider(player, groups.ground);

    // Add one-way collision between player and platforms (can jump through from below)
    this.scene.physics.add.collider(
      player,
      groups.platforms,
      undefined,
      this.createPlatformCollisionCallback()
    );

    // Add collision between player and boundaries
    this.scene.physics.add.collider(player, groups.boundaries);

    // Add overlap for climbeable interaction (pass-through, no collision)
    this.scene.physics.add.overlap(player, groups.climbeable, () => {
      // Climbeable interaction will be handled by ClimbingSystem
      // Player can pass through climbeable surfaces
    });

    // Configure climbing system if provided
    if (climbingSystem && climbingSystem.setClimbeableGroup) {
      climbingSystem.setClimbeableGroup(groups.climbeable);
    }
  }

  /**
   * Set up all collisions for enemies
   */
  public setupEnemyCollisions(enemyManager: EnemyManager, groups: CollisionGroups): void {
    const enemyGroup = enemyManager.getEnemyGroup();

    // Set up enemy collision with ground
    this.scene.physics.add.collider(enemyGroup, groups.ground);

    // Set up enemy collision with platforms (one-way)
    this.scene.physics.add.collider(
      enemyGroup,
      groups.platforms,
      undefined,
      this.createPlatformCollisionCallback()
    );

    // Set up enemy collision with boundaries
    this.scene.physics.add.collider(enemyGroup, groups.boundaries);
  }

  /**
   * Set up player-enemy interactions
   */
  public setupPlayerEnemyInteractions(
    player: Player,
    enemyManager: EnemyManager,
    onPlayerTouchEnemy: (player: any, enemy: any) => void,
    context: any
  ): void {
    // Set up player-enemy collision for hurt animation
    this.scene.physics.add.overlap(
      player,
      enemyManager.getEnemyGroup(),
      onPlayerTouchEnemy,
      undefined,
      context
    );
  }

  /**
   * Set up attack collision detection
   */
  public setupAttackCollisions(
    attackHitbox: Phaser.Physics.Arcade.Sprite,
    enemyManager: EnemyManager,
    onAttackHitEnemy: (hitbox: any, enemy: any) => void,
    context: any
  ): void {
    this.scene.physics.add.overlap(
      attackHitbox,
      enemyManager.getEnemyGroup(),
      onAttackHitEnemy,
      undefined,
      context
    );
  }

  /**
   * Create a one-way platform collision callback
   */
  private createPlatformCollisionCallback(): (object1: any, object2: any) => boolean {
    return (object1: any, platform: any) => {
      const body = object1.body as Phaser.Physics.Arcade.Body;
      const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;

      // Only allow collision if object is coming from above (falling down)
      return body.velocity.y > 0 && body.y < platformBody.y;
    };
  }

  /**
   * Helper to set up all collisions at once
   */
  public setupAllCollisions(
    player: Player,
    enemyManager: EnemyManager,
    groups: CollisionGroups,
    combatSystem: any,
    climbingSystem: any,
    callbacks: {
      onPlayerTouchEnemy: (player: any, enemy: any) => void;
      onAttackHitEnemy: (hitbox: any, enemy: any) => void;
    },
    context: any
  ): void {
    // Set up player collisions
    this.setupPlayerCollisions(player, groups, climbingSystem);

    // Set up enemy collisions
    this.setupEnemyCollisions(enemyManager, groups);

    // Set up player-enemy interactions
    this.setupPlayerEnemyInteractions(player, enemyManager, callbacks.onPlayerTouchEnemy, context);

    // Set up attack collisions if combat system exists
    if (combatSystem) {
      // Check if it's the enhanced combat system with multiple hitboxes
      if (combatSystem.setupCollisions && enemyManager.getEnemyGroup()) {
        combatSystem.setupCollisions(
          enemyManager.getEnemyGroup(),
          callbacks.onAttackHitEnemy,
          context
        );
      } else if (combatSystem.getHitboxSprite) {
        // Fallback for regular combat system
        this.setupAttackCollisions(
          combatSystem.getHitboxSprite(),
          enemyManager,
          callbacks.onAttackHitEnemy,
          context
        );
      }
    }
  }
}
