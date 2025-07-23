import Phaser from "phaser";
import { DbConnection, Enemy as ServerEnemy, PlayerState } from "@/spacetime/client";
import { AnimationFactory, ANIMATION_DEFINITIONS } from "../animations";
import { EnemyStateManager, type EnemyStateService } from "./enemy-state-service";
import { ENEMY_CONFIG } from "./enemy-config";

export class EnemyManager {
    private scene: Phaser.Scene;
    private dbConnection: DbConnection | null = null;
    private enemies = new Map<number, Phaser.Physics.Arcade.Sprite>();
    private enemyStates = new Map<number, PlayerState>();
    private enemyGroup!: Phaser.Physics.Arcade.Group;
    private animationFactory: AnimationFactory;
    private stateService: EnemyStateService;
    private enemyInterpolation = new Map<number, { targetX: number; startX: number; startTime: number; }>(); 

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.animationFactory = new AnimationFactory(scene);
        this.stateService = new EnemyStateManager(this.enemies, this.enemyStates);
        this.setupEnemyGroup();
        this.setupEnemyAnimations();
        this.setupInterpolationUpdate();
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

    private setupInterpolationUpdate(): void {
        // Update interpolation every frame
        this.scene.events.on('update', () => {
            this.updateInterpolation();
        });
    }

    private updateInterpolation(): void {
        const currentTime = this.scene.time.now;
        const interpolationDuration = 100; // 100ms to match server update frequency

        for (const [enemyId, interpolationData] of this.enemyInterpolation.entries()) {
            const sprite = this.enemies.get(enemyId);
            if (!sprite) continue;

            const elapsed = currentTime - interpolationData.startTime;
            const progress = Math.min(elapsed / interpolationDuration, 1);

            // Smooth interpolation using easeOutQuad
            const easeProgress = 1 - (1 - progress) * (1 - progress);
            const interpolatedX = interpolationData.startX + (interpolationData.targetX - interpolationData.startX) * easeProgress;

            sprite.setX(interpolatedX);

            // Clean up completed interpolations
            if (progress >= 1) {
                this.enemyInterpolation.delete(enemyId);
            }
        }
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

        const sprite = this.createEnemySprite(serverEnemy);
        const isDead = serverEnemy.state.tag === "Dead";
        
        this.configureEnemySprite(sprite);
        this.initializeEnemyAnimation(sprite, serverEnemy.enemyType, isDead);
        this.configureEnemyPhysics(sprite, isDead);
        this.registerEnemy(sprite, serverEnemy);
    }

    /**
     * Create the basic enemy sprite with position and texture
     */
    private createEnemySprite(serverEnemy: ServerEnemy): Phaser.Physics.Arcade.Sprite {
        const spriteKey = serverEnemy.enemyType;
        
        return this.scene.physics.add.sprite(
            serverEnemy.position.x,
            serverEnemy.position.y,
            spriteKey
        );
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
    private initializeEnemyAnimation(sprite: Phaser.Physics.Arcade.Sprite, enemyType: string, isDead: boolean): void {
        if (isDead) {
            this.setDeadVisuals(sprite, enemyType);
        } else {
            sprite.setFrame(0);
            sprite.play(`${enemyType}-idle-anim`);
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
     * Register enemy in collections and groups
     */
    private registerEnemy(sprite: Phaser.Physics.Arcade.Sprite, serverEnemy: ServerEnemy): void {
        this.enemyGroup.add(sprite);
        this.enemies.set(serverEnemy.enemyId, sprite);
        this.enemyStates.set(serverEnemy.enemyId, serverEnemy.state);
    }

    public playHitAnimation(enemyId: number): void {
        const sprite = this.enemies.get(enemyId);
        if (sprite) {
            // Play hit animation
            sprite.play("orc-hit-anim");

            // Return to idle after hit animation completes, but only if enemy isn't dead
            sprite.once("animationcomplete", () => {
                if (sprite.active) {
                    // Check if enemy died during hit animation using state service
                    if (!this.stateService.isEnemyDead(enemyId)) {
                        sprite.play("orc-idle-anim");
                    }
                    // If dead, let death animation take precedence
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

    public isEnemyDead(enemySprite: Phaser.Physics.Arcade.Sprite): boolean {
        const enemyId = this.getEnemyIdFromSprite(enemySprite);
        if (enemyId === null) return false;
        
        const isDead = this.stateService.isEnemyDead(enemyId);
        console.log(`Enemy ${enemyId} state check: ${isDead ? 'Dead' : 'Alive'}`);
        return isDead;
    }

    public canEnemyTakeDamage(enemyId: number): boolean {
        return this.stateService.canEnemyTakeDamage(enemyId);
    }

    public canEnemyDamagePlayer(enemyId: number): boolean {
        return this.stateService.canEnemyDamagePlayer(enemyId);
    }

    private despawnServerEnemy(enemyId: number): void {
        const sprite = this.enemies.get(enemyId);
        if (sprite) {
            // Remove from physics group immediately to prevent further interactions
            this.enemyGroup.remove(sprite);
            
            // Disable physics body to prevent collisions during fade
            if (sprite.body) {
                sprite.body.enable = false;
            }
            
            // Fade out the sprite over 1 second, then destroy
            this.scene.tweens.add({
                targets: sprite,
                alpha: 0,
                duration: 1000,
                ease: 'Power2.easeOut',
                onComplete: () => {
                    sprite.destroy();
                }
            });
            
            // Clean up references immediately (sprite still fading but no longer interactive)
            this.enemies.delete(enemyId);
            this.enemyStates.delete(enemyId);
            this.enemyInterpolation.delete(enemyId);
        }
    }

    private updateServerEnemy(serverEnemy: ServerEnemy): void {
        const sprite = this.enemies.get(serverEnemy.enemyId);
        if (!sprite) return;

        // Store previous position for movement detection
        const previousX = sprite.x;
        
        // Start interpolation to new X position instead of direct setting
        const targetX = serverEnemy.position.x;
        if (Math.abs(targetX - sprite.x) > 0.1) {
            this.enemyInterpolation.set(serverEnemy.enemyId, {
                targetX: targetX,
                startX: sprite.x,
                startTime: this.scene.time.now
            });
        }

        // Update facing direction
        if (serverEnemy.facing.tag === "Left") {
            sprite.setFlipX(true);
        } else {
            sprite.setFlipX(false);
        }

        // Check for state changes
        const previousState = this.enemyStates.get(serverEnemy.enemyId);
        const currentState = serverEnemy.state;

        if (previousState?.tag !== currentState.tag) {
            this.handleStateChange(serverEnemy.enemyId, sprite, currentState, serverEnemy.enemyType);
            this.enemyStates.set(serverEnemy.enemyId, currentState);
        }

        // Handle movement animation for idle enemies (patrol movement)
        if (currentState.tag === "Idle" && Math.abs(targetX - previousX) > 0.1) {
            // Enemy is moving horizontally - play walk animation
            if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== `${serverEnemy.enemyType}-walk-anim`) {
                sprite.play(`${serverEnemy.enemyType}-walk-anim`);
            }
        } else if (currentState.tag === "Idle") {
            // Enemy is not moving - play idle animation
            if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== `${serverEnemy.enemyType}-idle-anim`) {
                sprite.play(`${serverEnemy.enemyType}-idle-anim`);
            }
        }

        // Clear any tint - enemies maintain their natural color
        sprite.clearTint();
    }

    private handleStateChange(enemyId: number, sprite: Phaser.Physics.Arcade.Sprite, newState: PlayerState, enemyType: string): void {
        console.log(`Enemy ${enemyId} state changed to ${newState.tag}`);

        switch (newState.tag) {
            case "Dead":
                // Cancel any ongoing animations (like hit animation) before playing death
                sprite.anims.stop();
                this.handleDeathState(sprite, enemyType);
                break;
            case "Idle":
                // Return to idle animation
                sprite.play(`${enemyType}-idle-anim`);
                break;
            case "Walk":
                // Could add walk animation if needed
                sprite.play(`${enemyType}-idle-anim`); // Fallback to idle for now
                break;
            case "Damaged":
                // Damaged state is handled by playHitAnimation, but we can also handle it here
                break;
            default:
                // For any other states, fallback to idle
                sprite.play(`${enemyType}-idle-anim`);
                break;
        }
    }

    private handleDeathState(sprite: Phaser.Physics.Arcade.Sprite, enemyType: string): void {
        // Play death animation and stop on last frame
        sprite.play(`${enemyType}-death-anim`);
        
        // When death animation completes, stop on the last frame
        sprite.once("animationcomplete", () => {
            if (sprite.active) {
                this.setDeadVisuals(sprite, enemyType);
            }
        });

        // Keep physics body enabled temporarily to let enemy fall to ground
        if (sprite.body) {
            const body = sprite.body as Phaser.Physics.Arcade.Body;
            // Allow the body to fall with gravity but prevent horizontal movement
            body.setVelocityX(0);
            body.setImmovable(false);
            
            // Disable physics after a short delay to let enemy settle on ground
            setTimeout(() => {
                if (sprite.active && sprite.body) {
                    body.setEnable(false);
                }
            }, ENEMY_CONFIG.physics.deathFallDelay);
        }

        // Visual effects for death
        sprite.setDepth(ENEMY_CONFIG.display.deadDepth);
        
        console.log(`Enemy ${enemyType} died and death animation started`);
    }

    private setDeadVisuals(sprite: Phaser.Physics.Arcade.Sprite, enemyType: string): void {
        // Stop the animation and keep it on the last frame
        sprite.anims.stop();
        // Set to the last frame of death animation (frame 44 for orc)
        const deathAnim = ANIMATION_DEFINITIONS[enemyType as keyof typeof ANIMATION_DEFINITIONS];
        if (deathAnim && 'death' in deathAnim) {
            sprite.setFrame(deathAnim.death.end);
        }
        sprite.setDepth(ENEMY_CONFIG.display.deadDepth);
    }

    public getEnemyGroup(): Phaser.Physics.Arcade.Group {
        return this.enemyGroup;
    }

    public destroy(): void {
        this.enemies.forEach((sprite) => {
            sprite.destroy();
        });
        this.enemies.clear();
        this.enemyStates.clear();
        this.enemyGroup.destroy();
    }
}
