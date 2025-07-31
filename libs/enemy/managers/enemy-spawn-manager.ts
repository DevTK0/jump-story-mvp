import Phaser from 'phaser';
import type { Spawn as ServerEnemy, DbConnection } from '@/spacetime/client';
import { ENEMY_CONFIG } from '../config/enemy-config';
import { EnemyHealthBar } from '../ui/enemy-health-bar';
import { EnemyStateMachine } from '../state/enemy-state-machine';
import { enemyAttributes } from '../../../apps/playground/config/enemy-attributes';

/**
 * Handles enemy spawning, despawning, and lifecycle management
 */
export class EnemySpawnManager {
  private scene: Phaser.Scene;
  private enemies = new Map<number, Phaser.Physics.Arcade.Sprite>();
  private enemyHealthBars = new Map<number, EnemyHealthBar>();
  private enemyStateMachines = new Map<number, EnemyStateMachine>();
  private enemyNameLabels = new Map<number, Phaser.GameObjects.Text>();
  private enemyGroup: Phaser.Physics.Arcade.Group;
  private dbConnection: DbConnection | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.enemyGroup = this.scene.physics.add.group();
  }

  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
  }

  /**
   * Spawn a new enemy from server data
   */
  public spawnEnemy(serverEnemy: ServerEnemy): Phaser.Physics.Arcade.Sprite {
    const sprite = this.createEnemySprite(serverEnemy);
    const isDead = serverEnemy.state.tag === 'Dead';

    this.configureEnemySprite(sprite);
    this.initializeEnemyAnimation(sprite, serverEnemy.enemy, isDead);
    this.configureEnemyPhysics(sprite, isDead);
    this.createHealthBar(serverEnemy, sprite);
    this.createNameLabel(serverEnemy, sprite);
    this.registerEnemy(sprite, serverEnemy);

    return sprite;
  }

  /**
   * Despawn an enemy with fade out effect
   */
  public despawnEnemy(spawnId: number): void {
    const sprite = this.enemies.get(spawnId);
    const healthBar = this.enemyHealthBars.get(spawnId);
    const nameLabel = this.enemyNameLabels.get(spawnId);

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
      this.enemies.delete(spawnId);

      // Clean up state machine
      const stateMachine = this.enemyStateMachines.get(spawnId);
      if (stateMachine) {
        stateMachine.destroy();
        this.enemyStateMachines.delete(spawnId);
      }
    }

    // Clean up health bar
    if (healthBar) {
      healthBar.destroy();
      this.enemyHealthBars.delete(spawnId);
    }
    
    // Clean up name label
    if (nameLabel) {
      nameLabel.destroy();
      this.enemyNameLabels.delete(spawnId);
    }
  }

  /**
   * Create the basic enemy sprite with position and texture
   */
  private createEnemySprite(serverEnemy: ServerEnemy): Phaser.Physics.Arcade.Sprite {
    const spriteKey = serverEnemy.enemy;
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
    } else {
      // Play idle animation for alive enemies
      const idleAnimKey = `${enemyType}-idle-anim`;
      if (sprite.anims && sprite.anims.exists(idleAnimKey)) {
        sprite.play(idleAnimKey);
      } else {
        // Set a default frame if animation doesn't exist
        sprite.setFrame(0);
      }
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
    // Query the Enemy table to get the max HP for this enemy type
    let maxHp = 100; // Default fallback
    
    if (this.dbConnection && this.dbConnection.db.enemy) {
      // Find the enemy configuration by name
      const enemyConfig = this.dbConnection.db.enemy.name.find(serverEnemy.enemy);
      if (enemyConfig) {
        maxHp = enemyConfig.health;
      } else {
        console.warn(`Enemy config not found for type: ${serverEnemy.enemy}, using default max HP`);
      }
    } else {
      console.warn('DbConnection not available for enemy health lookup, using default max HP');
    }
    
    const healthBar = new EnemyHealthBar(this.scene, sprite.x, sprite.y, maxHp);

    // Update health bar with current HP
    healthBar.updateHealth(serverEnemy.currentHp);

    this.enemyHealthBars.set(serverEnemy.spawnId, healthBar);
  }

  /**
   * Create name label for enemy
   */
  private createNameLabel(serverEnemy: ServerEnemy, sprite: Phaser.Physics.Arcade.Sprite): void {
    // Get enemy name from the enemy attributes configuration
    let enemyName = serverEnemy.enemy; // Default to type if name not found
    
    const enemyConfig = enemyAttributes.enemies[serverEnemy.enemy];
    if (enemyConfig && enemyConfig.name) {
      enemyName = enemyConfig.name;
    }
    
    // Create text label
    const nameLabel = this.scene.add.text(
      sprite.x,
      sprite.y + ENEMY_CONFIG.nameLabel.offsetY,
      enemyName,
      {
        fontSize: ENEMY_CONFIG.nameLabel.fontSize,
        color: ENEMY_CONFIG.nameLabel.color,
        stroke: ENEMY_CONFIG.nameLabel.stroke,
        strokeThickness: ENEMY_CONFIG.nameLabel.strokeThickness,
      }
    );
    
    nameLabel.setOrigin(0.5, 0.5);
    nameLabel.setDepth(ENEMY_CONFIG.nameLabel.depth);
    
    this.enemyNameLabels.set(serverEnemy.spawnId, nameLabel);
  }

  /**
   * Register enemy in collections and groups
   */
  private registerEnemy(sprite: Phaser.Physics.Arcade.Sprite, serverEnemy: ServerEnemy): void {
    this.enemyGroup.add(sprite);
    this.enemies.set(serverEnemy.spawnId, sprite);

    // Create state machine for this enemy
    const stateMachine = new EnemyStateMachine(
      serverEnemy.spawnId,
      sprite,
      serverEnemy.enemy,
      this.scene,
      serverEnemy.state
    );
    this.enemyStateMachines.set(serverEnemy.spawnId, stateMachine);
  }

  // Getters for other managers to access
  public getEnemy(spawnId: number): Phaser.Physics.Arcade.Sprite | undefined {
    return this.enemies.get(spawnId);
  }

  public getEnemies(): Map<number, Phaser.Physics.Arcade.Sprite> {
    return this.enemies;
  }

  public getHealthBar(spawnId: number): EnemyHealthBar | undefined {
    return this.enemyHealthBars.get(spawnId);
  }
  
  public getNameLabel(spawnId: number): Phaser.GameObjects.Text | undefined {
    return this.enemyNameLabels.get(spawnId);
  }

  public getStateMachine(spawnId: number): EnemyStateMachine | undefined {
    return this.enemyStateMachines.get(spawnId);
  }

  public getEnemyGroup(): Phaser.Physics.Arcade.Group {
    return this.enemyGroup;
  }

  public destroy(): void {
    this.enemies.forEach((sprite) => sprite.destroy());
    this.enemyHealthBars.forEach((healthBar) => healthBar.destroy());
    this.enemyStateMachines.forEach((stateMachine) => stateMachine.destroy());
    this.enemyNameLabels.forEach((nameLabel) => nameLabel.destroy());
    this.enemies.clear();
    this.enemyHealthBars.clear();
    this.enemyStateMachines.clear();
    this.enemyNameLabels.clear();
    this.enemyGroup.destroy();
  }
}
