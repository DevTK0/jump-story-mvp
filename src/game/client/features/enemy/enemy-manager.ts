import Phaser from "phaser";
import { DbConnection, Enemy as ServerEnemy } from "../../module_bindings";
import { AnimationFactory, ANIMATION_DEFINITIONS } from "../animations";

export class EnemyManager {
    private scene: Phaser.Scene;
    private dbConnection: DbConnection | null = null;
    private enemies = new Map<number, Phaser.Physics.Arcade.Sprite>();
    private enemyGroup!: Phaser.Physics.Arcade.Group;
    private animationFactory: AnimationFactory;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.animationFactory = new AnimationFactory(scene);
        this.setupEnemyGroup();
        this.setupEnemyAnimations();
    }

    private setupEnemyGroup(): void {
        this.enemyGroup = this.scene.physics.add.group();
    }

    private setupEnemyAnimations(): void {
        // Register orc animations using centralized definitions
        this.animationFactory.registerSpriteAnimations('orc', ANIMATION_DEFINITIONS.orc);
        
        // Create all orc animations
        this.animationFactory.createSpriteAnimations('orc');
    }

    public setDbConnection(connection: DbConnection): void {
        this.dbConnection = connection;
        this.setupServerSubscriptions();
    }

    private setupServerSubscriptions(): void {
        if (!this.dbConnection) return;

        // Subscribe to enemy table changes
        this.dbConnection.db.enemy.onInsert((_ctx, enemy) => {
            this.spawnServerEnemy(enemy);
        });

        this.dbConnection.db.enemy.onDelete((_ctx, enemy) => {
            this.despawnServerEnemy(enemy.enemyId);
        });

        this.dbConnection.db.enemy.onUpdate((_ctx, _oldEnemy, newEnemy) => {
            this.updateServerEnemy(newEnemy);
        });

        // Spawn existing enemies that are already in the database
        for (const enemy of this.dbConnection.db.enemy.iter()) {
            this.spawnServerEnemy(enemy);
        }
    }

    private spawnServerEnemy(serverEnemy: ServerEnemy): void {
        console.log("enemy: ", serverEnemy);

        // Use orc spritesheet directly based on enemyType
        const spriteKey = serverEnemy.enemyType; // "orc"

        // Create enemy sprite using the spritesheet
        const sprite = this.scene.physics.add.sprite(
            serverEnemy.position.x,
            serverEnemy.position.y,
            spriteKey
        );

        // Configure sprite same as player
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(3); // Match player scale (PLAYER_CONFIG.movement.scale)
        sprite.setDepth(5); // Lower depth than player (player uses depth 10)

        // Ensure no tint or blend mode interference
        sprite.clearTint();
        sprite.setBlendMode(Phaser.BlendModes.NORMAL);

        // Set initial frame to first frame of idle animation
        sprite.setFrame(0);

        // Play idle animation
        sprite.play(`${spriteKey}-idle-anim`);

        // Configure physics body for collision but no movement
        if (sprite.body) {
            const body = sprite.body as Phaser.Physics.Arcade.Body;
            body.setSize(10, 10); // Match player hitbox size
            body.setCollideWorldBounds(true);
            body.setImmovable(true); // Won't be pushed around by collisions
            body.setVelocity(0, 0); // No movement
        }

        // Add to group
        this.enemyGroup.add(sprite);

        // Store reference
        this.enemies.set(serverEnemy.enemyId, sprite);
    }

    public playHitAnimation(enemyId: number): void {
        const sprite = this.enemies.get(enemyId);
        if (sprite) {
            // Play hit animation
            sprite.play("orc-hit-anim");

            // Return to idle after hit animation completes
            sprite.once("animationcomplete", () => {
                if (sprite.active) {
                    // Check if sprite still exists
                    sprite.play("orc-idle-anim");
                }
            });
        }
    }

    public getEnemyIdFromSprite(
        sprite: Phaser.Physics.Arcade.Sprite
    ): number | null {
        for (const [enemyId, enemySprite] of this.enemies) {
            if (enemySprite === sprite) {
                return enemyId;
            }
        }
        return null;
    }

    private despawnServerEnemy(enemyId: number): void {
        const sprite = this.enemies.get(enemyId);
        if (sprite) {
            this.enemyGroup.remove(sprite);
            sprite.destroy();
            this.enemies.delete(enemyId);
        }
    }

    private updateServerEnemy(serverEnemy: ServerEnemy): void {
        const sprite = this.enemies.get(serverEnemy.enemyId);
        if (sprite) {
            // Update position if it changed
            sprite.setPosition(serverEnemy.position.x, serverEnemy.position.y);

            // Could add HP-based visual effects here later
            // e.g., tint based on currentHp percentage
        }
    }

    public getEnemyGroup(): Phaser.Physics.Arcade.Group {
        return this.enemyGroup;
    }

    public destroy(): void {
        this.enemies.forEach((sprite) => {
            sprite.destroy();
        });
        this.enemies.clear();
        this.enemyGroup.destroy();
    }
}
