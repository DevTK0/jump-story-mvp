import Phaser from "phaser";
import {
    DbConnection,
    Enemy as ServerEnemy,
    PlayerState,
} from "@/spacetime/client";
import { AnimationFactory, ANIMATION_DEFINITIONS } from "../animations";
import {
    EnemyStateManager,
    type EnemyStateService,
} from "./enemy-state-service";
import { ENEMY_CONFIG } from "./enemy-config";
import { EnemyHealthBar } from "./enemy-health-bar";

export interface EnemySubscriptionConfig {
    /** Use proximity-based subscriptions to limit enemies loaded */
    useProximitySubscription: boolean;
    /** Distance around player to load enemies (in pixels) */
    proximityRadius: number;
    /** How often to update proximity subscription (in milliseconds) */
    proximityUpdateInterval: number;
}

export class EnemyManager {
    private scene: Phaser.Scene;
    private dbConnection: DbConnection | null = null;
    private enemies = new Map<number, Phaser.Physics.Arcade.Sprite>();
    private enemyStates = new Map<number, PlayerState>();
    private enemyHealthBars = new Map<number, EnemyHealthBar>();
    private enemyGroup!: Phaser.Physics.Arcade.Group;
    private animationFactory: AnimationFactory;
    private stateService: EnemyStateService;
    private enemyInterpolation = new Map<
        number,
        { targetX: number; startX: number; startTime: number }
    >();

    // Proximity-based subscription configuration
    private subscriptionConfig: EnemySubscriptionConfig;
    private proximityUpdateTimer: Phaser.Time.TimerEvent | null = null;
    private lastPlayerPosition: { x: number; y: number } | null = null;

    // Default configuration
    private static readonly DEFAULT_SUBSCRIPTION_CONFIG: EnemySubscriptionConfig =
        {
            useProximitySubscription: false, // Disabled by default for backward compatibility
            proximityRadius: 2000, // 2000 pixels around player
            proximityUpdateInterval: 5000, // Update every 5 seconds
        };

    constructor(
        scene: Phaser.Scene,
        subscriptionConfig?: Partial<EnemySubscriptionConfig>
    ) {
        this.scene = scene;
        this.animationFactory = new AnimationFactory(scene);
        this.stateService = new EnemyStateManager(
            this.enemies,
            this.enemyStates
        );
        this.subscriptionConfig = {
            ...EnemyManager.DEFAULT_SUBSCRIPTION_CONFIG,
            ...subscriptionConfig,
        };
        this.setupEnemyGroup();
        this.setupEnemyAnimations();
        this.setupInterpolationUpdate();
    }

    private setupEnemyGroup(): void {
        this.enemyGroup = this.scene.physics.add.group();
    }

    private setupEnemyAnimations(): void {
        // Register orc animations using centralized definitions
        this.animationFactory.registerSpriteAnimations(
            "orc",
            ANIMATION_DEFINITIONS.orc
        );

        // Create all orc animations
        this.animationFactory.createSpriteAnimations("orc");
    }

    private setupInterpolationUpdate(): void {
        // Update interpolation every frame
        this.scene.events.on("update", () => {
            this.updateInterpolation();
        });
    }

    private updateInterpolation(): void {
        const currentTime = this.scene.time.now;
        const interpolationDuration = 100; // 100ms to match server update frequency

        for (const [
            enemyId,
            interpolationData,
        ] of this.enemyInterpolation.entries()) {
            const sprite = this.enemies.get(enemyId);
            const healthBar = this.enemyHealthBars.get(enemyId);
            if (!sprite) continue;

            const elapsed = currentTime - interpolationData.startTime;
            const progress = Math.min(elapsed / interpolationDuration, 1);

            // Smooth interpolation using easeOutQuad
            const easeProgress = 1 - (1 - progress) * (1 - progress);
            const interpolatedX =
                interpolationData.startX +
                (interpolationData.targetX - interpolationData.startX) *
                    easeProgress;

            sprite.setX(interpolatedX);

            // Update health bar position during interpolation
            if (healthBar) {
                healthBar.updatePosition(interpolatedX, sprite.y);
            }

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

        if (this.subscriptionConfig.useProximitySubscription) {
            this.setupProximityBasedSubscription();
        } else {
            this.setupGlobalSubscription();
        }
    }

    /**
     * Set up proximity-based subscription for better scalability
     * Only loads enemies within a certain radius of the player
     */
    private setupProximityBasedSubscription(): void {
        if (!this.dbConnection) return;

        try {
            // Start proximity subscription timer
            this.startProximityUpdateTimer();

            // Set up event listeners for targeted enemy data
            this.setupTargetedEnemyEventListeners();

            // Initial proximity subscription
            this.updateProximitySubscription();

            // Proximity-based subscription active
        } catch (error) {
            console.error(
                "EnemyManager: Failed to set up proximity subscription:",
                error
            );
            // Falling back to global subscription
            this.setupGlobalSubscription();
        }
    }

    /**
     * Set up global subscription (original behavior)
     * Subscribes to all enemies in the game world
     */
    private setupGlobalSubscription(): void {
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

    /**
     * Set up event listeners for proximity-based enemy subscription
     */
    private setupTargetedEnemyEventListeners(): void {
        if (!this.dbConnection) return;

        // With proximity subscription, events will only fire for nearby enemies
        this.dbConnection.db.enemy.onInsert((_ctx, enemy) => {
            // console.log(
            //     "🎯 EnemyManager: Nearby enemy spawned via proximity subscription:",
            //     enemy.enemyId
            // );
            this.spawnServerEnemy(enemy);
        });

        this.dbConnection.db.enemy.onDelete((_ctx, enemy) => {
            // console.log(
            //     "🎯 EnemyManager: Nearby enemy deleted via proximity subscription:",
            //     enemy.enemyId
            // );
            this.despawnServerEnemy(enemy.enemyId);
        });

        this.dbConnection.db.enemy.onUpdate((_ctx, _oldEnemy, newEnemy) => {
            // console.log('🎯 EnemyManager: Nearby enemy updated via proximity subscription:', newEnemy.enemyId);
            this.updateServerEnemy(newEnemy);
        });
    }

    /**
     * Start timer to periodically update proximity subscription based on player movement
     */
    private startProximityUpdateTimer(): void {
        if (this.proximityUpdateTimer) {
            this.proximityUpdateTimer.destroy();
        }

        this.proximityUpdateTimer = this.scene.time.addEvent({
            delay: this.subscriptionConfig.proximityUpdateInterval,
            loop: true,
            callback: this.updateProximitySubscription,
            callbackScope: this,
        });
    }

    /**
     * Update proximity subscription based on current player position
     */
    private updateProximitySubscription(): void {
        if (!this.dbConnection) return;

        // Get player position (you might need to access this from a player manager or scene)
        const playerPosition = this.getPlayerPosition();
        if (!playerPosition) {
            console.warn(
                "EnemyManager: Cannot update proximity subscription - player position unknown"
            );
            return;
        }

        // Check if player has moved significantly since last update
        if (
            this.lastPlayerPosition &&
            Math.abs(playerPosition.x - this.lastPlayerPosition.x) < 100 &&
            Math.abs(playerPosition.y - this.lastPlayerPosition.y) < 100
        ) {
            // Player hasn't moved much, but still check for enemies to remove
            this.loadProximityEnemies();
            return;
        }

        const radius = this.subscriptionConfig.proximityRadius;
        const minX = playerPosition.x - radius;
        const maxX = playerPosition.x + radius;
        const minY = playerPosition.y - radius;
        const maxY = playerPosition.y + radius;

        try {
            // Subscribe to enemies within proximity using SQL query
            this.dbConnection
                .subscriptionBuilder()
                .onApplied(() => {
                    this.loadProximityEnemies();
                })
                .subscribe([
                    `SELECT * FROM Enemy WHERE position.x BETWEEN ${minX} AND ${maxX} AND position.y BETWEEN ${minY} AND ${maxY}`,
                ]);

            this.lastPlayerPosition = { ...playerPosition };
        } catch (error) {
            console.error(
                "EnemyManager: Failed to update proximity subscription:",
                error
            );
        }
    }

    /**
     * Load existing enemies within proximity when subscription is applied
     * Also removes enemies that are now outside the proximity area
     */
    private loadProximityEnemies(): void {
        if (!this.dbConnection) return;

        const playerPosition = this.getPlayerPosition();
        if (!playerPosition) return;

        const radius = this.subscriptionConfig.proximityRadius;
        const currentEnemyIds = new Set<number>();

        // Load enemies that are within proximity
        for (const enemy of this.dbConnection.db.enemy.iter()) {
            const distance = Math.sqrt(
                Math.pow(enemy.position.x - playerPosition.x, 2) +
                    Math.pow(enemy.position.y - playerPosition.y, 2)
            );

            if (distance <= radius) {
                currentEnemyIds.add(enemy.enemyId);
                if (!this.enemies.has(enemy.enemyId)) {
                    // console.log(
                    //     `🎯 EnemyManager: Loading nearby enemy ${
                    //         enemy.enemyId
                    //     } at distance ${Math.round(distance)}`
                    // );
                    this.spawnServerEnemy(enemy);
                }
            }
        }

        // Remove enemies that are no longer in proximity
        for (const [enemyId] of this.enemies) {
            if (!currentEnemyIds.has(enemyId)) {
                // console.log(
                //     `🎯 EnemyManager: Removing enemy ${enemyId} - now outside proximity`
                // );
                this.despawnServerEnemy(enemyId);
            }
        }
    }

    /**
     * Get current player position from the scene
     * First tries to get actual player position, falls back to camera center
     */
    private getPlayerPosition(): { x: number; y: number } | null {
        // Try to get player from scene data (PlaygroundScene has a 'player' property)
        const playgroundScene = this.scene as any;
        if (
            playgroundScene.player &&
            playgroundScene.player.x !== undefined &&
            playgroundScene.player.y !== undefined
        ) {
            return {
                x: playgroundScene.player.x,
                y: playgroundScene.player.y,
            };
        }

        // Fallback to camera center if player not accessible
        if (this.scene.cameras && this.scene.cameras.main) {
            const camera = this.scene.cameras.main;
            return {
                x: camera.centerX,
                y: camera.centerY,
            };
        }

        return null;
    }

    private spawnServerEnemy(serverEnemy: ServerEnemy): void {
        const sprite = this.createEnemySprite(serverEnemy);
        const isDead = serverEnemy.state.tag === "Dead";

        this.configureEnemySprite(sprite);
        this.initializeEnemyAnimation(sprite, serverEnemy.enemyType, isDead);
        this.configureEnemyPhysics(sprite, isDead);
        this.createHealthBar(serverEnemy, sprite);
        this.registerEnemy(sprite, serverEnemy);
    }

    /**
     * Create the basic enemy sprite with position and texture
     */
    private createEnemySprite(
        serverEnemy: ServerEnemy
    ): Phaser.Physics.Arcade.Sprite {
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
    private initializeEnemyAnimation(
        sprite: Phaser.Physics.Arcade.Sprite,
        enemyType: string,
        isDead: boolean
    ): void {
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
    private configureEnemyPhysics(
        sprite: Phaser.Physics.Arcade.Sprite,
        isDead: boolean
    ): void {
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
    private createHealthBar(
        serverEnemy: ServerEnemy,
        sprite: Phaser.Physics.Arcade.Sprite
    ): void {
        // Assume max HP is 100 (this should ideally come from server data)
        const maxHp = 100;
        const healthBar = new EnemyHealthBar(
            this.scene,
            sprite.x,
            sprite.y,
            maxHp
        );

        // Update health bar with current HP
        healthBar.updateHealth(serverEnemy.currentHp);

        this.enemyHealthBars.set(serverEnemy.enemyId, healthBar);
    }

    /**
     * Register enemy in collections and groups
     */
    private registerEnemy(
        sprite: Phaser.Physics.Arcade.Sprite,
        serverEnemy: ServerEnemy
    ): void {
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
        const healthBar = this.enemyHealthBars.get(enemyId);

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
                ease: "Power2.easeOut",
                onComplete: () => {
                    sprite.destroy();
                },
            });

            // Clean up references immediately (sprite still fading but no longer interactive)
            this.enemies.delete(enemyId);
            this.enemyStates.delete(enemyId);
            this.enemyInterpolation.delete(enemyId);
        }

        // Clean up health bar
        if (healthBar) {
            healthBar.destroy();
            this.enemyHealthBars.delete(enemyId);
        }
    }

    private updateServerEnemy(serverEnemy: ServerEnemy): void {
        const sprite = this.enemies.get(serverEnemy.enemyId);
        const healthBar = this.enemyHealthBars.get(serverEnemy.enemyId);
        if (!sprite) return;

        // Store previous position for movement detection
        const previousX = sprite.x;

        // Start interpolation to new X position instead of direct setting
        const targetX = serverEnemy.position.x;
        if (Math.abs(targetX - sprite.x) > 0.1) {
            this.enemyInterpolation.set(serverEnemy.enemyId, {
                targetX: targetX,
                startX: sprite.x,
                startTime: this.scene.time.now,
            });
        }

        // Update facing direction
        if (serverEnemy.facing.tag === "Left") {
            sprite.setFlipX(true);
        } else {
            sprite.setFlipX(false);
        }

        // Update health bar position and health
        if (healthBar) {
            healthBar.updatePosition(sprite.x, sprite.y);
            healthBar.updateHealth(serverEnemy.currentHp);
        }

        // Check for state changes
        const previousState = this.enemyStates.get(serverEnemy.enemyId);
        const currentState = serverEnemy.state;

        if (previousState?.tag !== currentState.tag) {
            this.handleStateChange(
                serverEnemy.enemyId,
                sprite,
                currentState,
                serverEnemy.enemyType
            );
            this.enemyStates.set(serverEnemy.enemyId, currentState);

            // Hide health bar when enemy dies
            if (currentState.tag === "Dead" && healthBar) {
                healthBar.hide();
            }
        }

        // Handle movement animation for idle enemies (patrol movement)
        if (
            currentState.tag === "Idle" &&
            Math.abs(targetX - previousX) > 0.1
        ) {
            // Enemy is moving horizontally - play walk animation
            if (
                !sprite.anims.isPlaying ||
                sprite.anims.currentAnim?.key !==
                    `${serverEnemy.enemyType}-walk-anim`
            ) {
                sprite.play(`${serverEnemy.enemyType}-walk-anim`);
            }
        } else if (currentState.tag === "Idle") {
            // Enemy is not moving - play idle animation
            if (
                !sprite.anims.isPlaying ||
                sprite.anims.currentAnim?.key !==
                    `${serverEnemy.enemyType}-idle-anim`
            ) {
                sprite.play(`${serverEnemy.enemyType}-idle-anim`);
            }
        }

        // Clear any tint - enemies maintain their natural color
        sprite.clearTint();
    }

    private handleStateChange(
        _enemyId: number,
        sprite: Phaser.Physics.Arcade.Sprite,
        newState: PlayerState,
        enemyType: string
    ): void {
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

    private handleDeathState(
        sprite: Phaser.Physics.Arcade.Sprite,
        enemyType: string
    ): void {
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
    }

    private setDeadVisuals(
        sprite: Phaser.Physics.Arcade.Sprite,
        enemyType: string
    ): void {
        // Stop the animation and keep it on the last frame
        sprite.anims.stop();
        // Set to the last frame of death animation (frame 44 for orc)
        const deathAnim =
            ANIMATION_DEFINITIONS[
                enemyType as keyof typeof ANIMATION_DEFINITIONS
            ];
        if (deathAnim && "death" in deathAnim) {
            sprite.setFrame(deathAnim.death.end);
        }
        sprite.setDepth(ENEMY_CONFIG.display.deadDepth);
    }

    public getEnemyGroup(): Phaser.Physics.Arcade.Group {
        return this.enemyGroup;
    }

    public destroy(): void {
        // Clean up proximity timer if it exists
        if (this.proximityUpdateTimer) {
            this.proximityUpdateTimer.destroy();
            this.proximityUpdateTimer = null;
        }

        this.enemies.forEach((sprite) => {
            sprite.destroy();
        });
        this.enemyHealthBars.forEach((healthBar) => {
            healthBar.destroy();
        });
        this.enemies.clear();
        this.enemyStates.clear();
        this.enemyHealthBars.clear();
        this.enemyInterpolation.clear();
        this.enemyGroup.destroy();
    }
}
