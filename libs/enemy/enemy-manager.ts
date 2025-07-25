import Phaser from "phaser";
import {
    DbConnection,
    Enemy as ServerEnemy,
    PlayerState,
} from "@/spacetime/client";
import {
    EnemyStateManager,
} from "./state/enemy-state-service";
import { ENEMY_CONFIG } from "./config/enemy-config";
import { EnemyHealthBar } from "./ui/enemy-health-bar";
import { EnemyStateMachine } from "./state/enemy-state-machine";

export interface EnemySubscriptionConfig {
    /** Use proximity-based subscriptions to limit enemies loaded */
    useProximitySubscription: boolean;
    /** Distance around player to load enemies (in pixels) */
    proximityRadius: number;
    /** How often to update proximity subscription (in milliseconds) - deprecated, use subscriptionDistanceThreshold instead */
    proximityUpdateInterval?: number;
    /** Distance player must move before updating subscription (in pixels) */
    subscriptionDistanceThreshold?: number;
}

export class EnemyManager {
    private scene: Phaser.Scene;
    private dbConnection: DbConnection | null = null;
    private enemies = new Map<number, Phaser.Physics.Arcade.Sprite>();
    private enemyStates = new Map<number, PlayerState>();
    private enemyHealthBars = new Map<number, EnemyHealthBar>();
    private enemyTypes = new Map<number, string>();
    private enemyGroup!: Phaser.Physics.Arcade.Group;
    private stateService: EnemyStateManager;
    private enemyStateMachines = new Map<number, EnemyStateMachine>();
    private enemyInterpolation = new Map<
        number,
        { targetX: number; startX: number; startTime: number }
    >();

    // Proximity-based subscription configuration
    private subscriptionConfig: EnemySubscriptionConfig;
    private proximityUpdateTimer: Phaser.Time.TimerEvent | null = null;
    private lastSubscriptionCenter: { x: number; y: number } | null = null;

    // Default configuration
    private static readonly DEFAULT_SUBSCRIPTION_CONFIG: EnemySubscriptionConfig =
        {
            useProximitySubscription: false, // Disabled by default for backward compatibility
            proximityRadius: 2000, // 2000 pixels around player
            proximityUpdateInterval: 5000, // Update every 5 seconds (deprecated)
            subscriptionDistanceThreshold: 100, // Update subscription when player moves 100 pixels
        };

    constructor(
        scene: Phaser.Scene,
        subscriptionConfig?: Partial<EnemySubscriptionConfig>
    ) {
        this.scene = scene;
        // No longer create AnimationFactory - animations are created at scene level
        this.stateService = new EnemyStateManager(
            this.enemies,
            this.enemyStates
        );
        this.subscriptionConfig = {
            ...EnemyManager.DEFAULT_SUBSCRIPTION_CONFIG,
            ...subscriptionConfig,
        };
        this.setupEnemyGroup();
        this.verifyEnemyAnimations();
        this.setupInterpolationUpdate();
    }

    private setupEnemyGroup(): void {
        this.enemyGroup = this.scene.physics.add.group();
    }

    private verifyEnemyAnimations(): void {
        // Verify animations exist (they should be created at scene level)
        if (!this.scene.anims.exists('orc-idle-anim')) {
            console.warn('Enemy animations not found! They should be created at scene level.');
        }
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
            // Set up distance-based proximity checking
            this.setupDistanceBasedProximityUpdate();

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
     * Set up distance-based proximity update checking
     * Updates subscription when player moves more than 1/4 of the proximity radius
     */
    private setupDistanceBasedProximityUpdate(): void {
        // Check player position every frame for distance-based updates
        this.scene.events.on("update", this.checkProximityDistanceUpdate, this);
    }

    /**
     * Check if player has moved far enough to warrant a proximity subscription update
     */
    private checkProximityDistanceUpdate(): void {
        if (!this.dbConnection) return;

        const playerPosition = this.getPlayerPosition();
        if (!playerPosition) return;

        // Calculate distance threshold (1/4 of proximity radius)
        const updateThreshold = this.subscriptionConfig.proximityRadius * 0.25;

        // Check if we need to update based on distance moved
        if (this.lastSubscriptionCenter) {
            const distanceMoved = Math.sqrt(
                Math.pow(playerPosition.x - this.lastSubscriptionCenter.x, 2) +
                Math.pow(playerPosition.y - this.lastSubscriptionCenter.y, 2)
            );

            if (distanceMoved >= updateThreshold) {
                this.updateProximitySubscription();
            }
        } else {
            // First time - set initial center
            this.updateProximitySubscription();
        }
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

        // Update the last subscription center
        this.lastSubscriptionCenter = { x: playerPosition.x, y: playerPosition.y };

        const radius = this.subscriptionConfig.proximityRadius;
        const minX = playerPosition.x - radius;
        const maxX = playerPosition.x + radius;
        const minY = playerPosition.y - radius;
        const maxY = playerPosition.y + radius;

        console.log(
            `🎯 EnemyManager: Updating proximity subscription - Center: (${playerPosition.x}, ${playerPosition.y}), radius: ${radius}px`
        );

        try {
            // Subscribe to enemies within proximity using SQL query
            this.dbConnection
                .subscriptionBuilder()
                .onApplied(() => {
                    this.loadProximityEnemies();
                })
                .subscribe([
                    `SELECT * FROM Enemy 
                     WHERE x >= ${minX} AND x <= ${maxX}
                     AND y >= ${minY} AND y <= ${maxY}`,
                ]);

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
                Math.pow(enemy.x - playerPosition.x, 2) +
                    Math.pow(enemy.y - playerPosition.y, 2)
            );

            if (distance <= radius) {
                currentEnemyIds.add(enemy.enemyId);
                if (!this.enemies.has(enemy.enemyId)) {
                    this.spawnServerEnemy(enemy);
                }
            }
        }
        
        // Remove enemies that are no longer in proximity
        for (const [enemyId] of this.enemies) {
            if (!currentEnemyIds.has(enemyId)) {
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
            serverEnemy.x,
            serverEnemy.y,
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
        // Initial animation is handled by the state machine
        // Just set the initial frame if dead
        if (isDead) {
            // Set to last frame of death animation
            // Death frames are defined in sprite-config.json
            const deathFrames: Record<string, number> = {
                orc: 43,  // Last frame of orc death animation
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
        this.enemyTypes.set(serverEnemy.enemyId, serverEnemy.enemyType);
        
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

    public playHitAnimation(enemyId: number): void {
        const stateMachine = this.enemyStateMachines.get(enemyId);
        if (stateMachine) {
            // Let the state machine handle hit animations
            stateMachine.playHitAnimation();
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

            // Fade out the sprite over 2 seconds for less noticeable culling
            this.scene.tweens.add({
                targets: sprite,
                alpha: 0,
                duration: 2000,
                ease: "Linear",
                onComplete: () => {
                    sprite.destroy();
                },
            });

            // Clean up references immediately (sprite still fading but no longer interactive)
            this.enemies.delete(enemyId);
            this.enemyStates.delete(enemyId);
            this.enemyTypes.delete(enemyId);
            this.enemyInterpolation.delete(enemyId);
            
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

    private updateServerEnemy(serverEnemy: ServerEnemy): void {
        const sprite = this.enemies.get(serverEnemy.enemyId);
        const healthBar = this.enemyHealthBars.get(serverEnemy.enemyId);
        if (!sprite) return;

        // Check proximity if using proximity subscription
        if (this.subscriptionConfig.useProximitySubscription) {
            const playerPosition = this.getPlayerPosition();
            if (playerPosition) {
                const distance = Math.sqrt(
                    Math.pow(serverEnemy.x - playerPosition.x, 2) +
                    Math.pow(serverEnemy.y - playerPosition.y, 2)
                );
                
                if (distance > this.subscriptionConfig.proximityRadius) {
                    // Enemy is now outside proximity - despawn it
                    this.despawnServerEnemy(serverEnemy.enemyId);
                    return;
                }
            }
        }

        // Store previous position for movement detection
        const previousX = sprite.x;

        // Start interpolation to new X position instead of direct setting
        const targetX = serverEnemy.x;
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
        enemyId: number,
        _sprite: Phaser.Physics.Arcade.Sprite,
        newState: PlayerState,
        _enemyType: string
    ): void {
        // Use state machine to handle state changes
        const stateMachine = this.enemyStateMachines.get(enemyId);
        if (stateMachine) {
            stateMachine.handleServerStateChange(newState);
        }
    }

    // Removed handleDeathState and setDeadVisuals - now handled by EnemyStateMachine

    public getEnemyGroup(): Phaser.Physics.Arcade.Group {
        return this.enemyGroup;
    }

    public destroy(): void {
        // Clean up proximity timer if it exists
        if (this.proximityUpdateTimer) {
            this.proximityUpdateTimer.destroy();
            this.proximityUpdateTimer = null;
        }

        // Clean up distance-based update listener
        this.scene.events.off("update", this.checkProximityDistanceUpdate, this);

        this.enemies.forEach((sprite) => {
            sprite.destroy();
        });
        this.enemyHealthBars.forEach((healthBar) => {
            healthBar.destroy();
        });
        this.enemyStateMachines.forEach((stateMachine) => {
            stateMachine.destroy();
        });
        this.enemies.clear();
        this.enemyStates.clear();
        this.enemyTypes.clear();
        this.enemyHealthBars.clear();
        this.enemyStateMachines.clear();
        this.enemyInterpolation.clear();
        this.enemyGroup.destroy();
    }
}
