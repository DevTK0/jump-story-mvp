import Phaser from 'phaser';
import type { Enemy as ServerEnemy } from '@/spacetime/client';
import { ENEMY_CONFIG } from '../config/enemy-config';
import { EnemyHealthBar } from '../ui/enemy-health-bar';
import { EnemyStateMachine } from '../state/enemy-state-machine';

/**
 * Handles enemy spawning, despawning, and lifecycle management
 */
export class EnemySpawnManager {
  private scene: Phaser.Scene;
  private enemies = new Map<number, Phaser.Physics.Arcade.Sprite>();
  private enemyHealthBars = new Map<number, EnemyHealthBar>();
  private enemyStateMachines = new Map<number, EnemyStateMachine>();
  private enemyGroup: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.enemyGroup = this.scene.physics.add.group();
  }

  /**
   * Spawn a new enemy from server data
   */
  public spawnEnemy(serverEnemy: ServerEnemy): Phaser.Physics.Arcade.Sprite {
    const sprite = this.createEnemySprite(serverEnemy);
    const isDead = serverEnemy.state.tag === 'Dead';

    this.configureEnemySprite(sprite);
    this.initializeEnemyAnimation(sprite, serverEnemy.enemyType, isDead);
    this.configureEnemyPhysics(sprite, isDead);
    this.createHealthBar(serverEnemy, sprite);
    this.registerEnemy(sprite, serverEnemy);

    return sprite;
  }

  /**
   * Despawn an enemy with fade out effect
   */
  public despawnEnemy(enemyId: number): void {
    const sprite = this.enemies.get(enemyId);
    const healthBar = this.enemyHealthBars.get(enemyId);

    if (sprite) {
      // Remove from physics group immediately to prevent further interactions
      this.enemyGroup.remove(sprite);

      // Disable physics body to prevent collisions during fade
      if (sprite.body) {
        sprite.body.enable = false;
      }

      // Fade out the sprite over 2 seconds for less noticeable culling
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        duration: 2000,
        ease: 'Linear',
        onComplete: () => {
          sprite.destroy();
        },
      });

      // Clean up references immediately (sprite still fading but no longer interactive)
      this.enemies.delete(enemyId);

      // Clean up state machine
      const stateMachine = this.enemyStateMachines.get(enemyId);
      if (stateMachine) {
        stateMachine.destroy();
        this.enemyStateMachines.delete(enemyId);
      }
    }

    // Clean up health bar
    if (healthBar) {
      healthBar.destroy();
      this.enemyHealthBars.delete(enemyId);
    }
  }

  /**
   * Create the basic enemy sprite with position and texture
   */
  private createEnemySprite(serverEnemy: ServerEnemy): Phaser.Physics.Arcade.Sprite {
    const spriteKey = serverEnemy.enemyType;
    return this.scene.physics.add.sprite(serverEnemy.x, serverEnemy.y, spriteKey);
  }

  /**
   * Apply basic sprite configuration (origin, scale, depth, visual properties)
   */
  private configureEnemySprite(sprite: Phaser.Physics.Arcade.Sprite): void {
    const { display } = ENEMY_CONFIG;
    sprite.setOrigin(display.origin.x, display.origin.y);
    sprite.setScale(display.scale);
    sprite.setDepth(display.depth);
    sprite.clearTint();
    sprite.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  /**
   * Initialize enemy animation based on its state (dead or alive)
   */
  private initializeEnemyAnimation(
    sprite: Phaser.Physics.Arcade.Sprite,
    enemyType: string,
    isDead: boolean
  ): void {
    if (isDead) {
      // Set to last frame of death animation
      const deathFrames: Record<string, number> = {
        orc: 43, // Last frame of orc death animation
        // Add other enemy types as needed
      };
      const deathFrame = deathFrames[enemyType] ?? 0;
      if (deathFrame > 0) {
        sprite.setFrame(deathFrame);
      }
      sprite.setTint(0x666666);
      sprite.setAlpha(0.8);
      sprite.setDepth(ENEMY_CONFIG.display.deadDepth);
    }
  }

  /**
   * Configure physics body for collision detection and behavior
   */
  private configureEnemyPhysics(sprite: Phaser.Physics.Arcade.Sprite, isDead: boolean): void {
    if (!sprite.body) return;

    const { physics } = ENEMY_CONFIG;
    const body = sprite.body as Phaser.Physics.Arcade.Body;

    body.setSize(physics.hitboxWidth, physics.hitboxHeight);
    body.setCollideWorldBounds(true);
    body.setImmovable(true); // Won't be pushed around by collisions
    body.setVelocity(physics.velocity.x, physics.velocity.y);

    if (isDead) {
      body.setEnable(false);
    }
  }

  /**
   * Create health bar for enemy
   */
  private createHealthBar(serverEnemy: ServerEnemy, sprite: Phaser.Physics.Arcade.Sprite): void {
    // Assume max HP is 100 (this should ideally come from server data)
    const maxHp = 100;
    const healthBar = new EnemyHealthBar(this.scene, sprite.x, sprite.y, maxHp);

    // Update health bar with current HP
    healthBar.updateHealth(serverEnemy.currentHp);

    this.enemyHealthBars.set(serverEnemy.enemyId, healthBar);
  }

  /**
   * Register enemy in collections and groups
   */
  private registerEnemy(sprite: Phaser.Physics.Arcade.Sprite, serverEnemy: ServerEnemy): void {
    this.enemyGroup.add(sprite);
    this.enemies.set(serverEnemy.enemyId, sprite);

    // Create state machine for this enemy
    const stateMachine = new EnemyStateMachine(
      serverEnemy.enemyId,
      sprite,
      serverEnemy.enemyType,
      this.scene,
      serverEnemy.state
    );
    this.enemyStateMachines.set(serverEnemy.enemyId, stateMachine);
  }

  // Getters for other managers to access
  public getEnemy(enemyId: number): Phaser.Physics.Arcade.Sprite | undefined {
    return this.enemies.get(enemyId);
  }

  public getEnemies(): Map<number, Phaser.Physics.Arcade.Sprite> {
    return this.enemies;
  }

  public getHealthBar(enemyId: number): EnemyHealthBar | undefined {
    return this.enemyHealthBars.get(enemyId);
  }

  public getStateMachine(enemyId: number): EnemyStateMachine | undefined {
    return this.enemyStateMachines.get(enemyId);
  }

  public getEnemyGroup(): Phaser.Physics.Arcade.Group {
    return this.enemyGroup;
  }

  public destroy(): void {
    this.enemies.forEach((sprite) => sprite.destroy());
    this.enemyHealthBars.forEach((healthBar) => healthBar.destroy());
    this.enemyStateMachines.forEach((stateMachine) => stateMachine.destroy());
    this.enemies.clear();
    this.enemyHealthBars.clear();
    this.enemyStateMachines.clear();
    this.enemyGroup.destroy();
  }
}
