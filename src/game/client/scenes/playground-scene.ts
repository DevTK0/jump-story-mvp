import Phaser from "phaser";
import { createPlayer, Player } from "../features/player";
import { EnemyManager } from "../features/enemy";
import { MapLoader, type MapData } from "../features/stage";
import { PeerManager } from "../features/peer";
import { PLAYER_CONFIG } from "../features/player";
import type { IDebuggable } from "../features/debug/debug-interfaces";
import { DEBUG_CONFIG } from "../features/debug/config";
import { DebugState } from "../features/debug/debug-state";
import { DatabaseConnectionManager } from "../managers";
import { DbConnection } from "../module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

// Scene-specific constants
const COLOR_BACKGROUND = 0x2c3e50;
const SPRITE_FRAME_WIDTH = 100;
const SPRITE_FRAME_HEIGHT = 100;
const CAMERA_SHAKE_DURATION = 100;
const CAMERA_SHAKE_INTENSITY = 0.03;

export class PlaygroundScene extends Phaser.Scene implements IDebuggable {
    private player!: Player;
    
    // Database connection
    private dbConnectionManager!: DatabaseConnectionManager;

    // System managers
    private enemyManager!: EnemyManager;
    private mapLoader!: MapLoader;
    private mapData!: MapData;
    private peerManager!: PeerManager;

    constructor() {
        super({ key: "playground" });
    }

    preload(): void {
        // Initialize map loader and load map assets
        this.mapLoader = new MapLoader(this);
        this.mapLoader.loadMapAssets();

        // Load unified soldier spritesheet

        this.load.spritesheet("soldier", "assets/spritesheet/Soldier.png", {
            frameWidth: SPRITE_FRAME_WIDTH,
            frameHeight: SPRITE_FRAME_HEIGHT,
        });

        // Load unified orc spritesheet
        this.load.spritesheet("orc", "assets/spritesheet/Orc.png", {
            frameWidth: SPRITE_FRAME_WIDTH,
            frameHeight: SPRITE_FRAME_HEIGHT,
        });
    }

    create(): void {
        // Initialize database connection manager
        this.dbConnectionManager = new DatabaseConnectionManager(
            {
                uri: "ws://localhost:3000",
                moduleName: "jump-story"
            },
            {
                onConnect: this.handleDatabaseConnect.bind(this),
                onDisconnect: () => console.log("Disconnected from SpacetimeDB"),
                onError: (_ctx, err) => console.error("Error connecting to SpacetimeDB:", err),
                onSubscriptionApplied: (_ctx) => console.log("Subscription applied!")
            }
        );

        // Start database connection
        this.dbConnectionManager.connect().catch(err => {
            console.error("Failed to connect to database:", err);
        });

        // Create background
        this.cameras.main.setBackgroundColor(COLOR_BACKGROUND);

        // Create map from Tiled data
        this.mapData = this.mapLoader.createMap();

        // Set physics world bounds to match tilemap dimensions
        const mapWidth = this.mapData.tilemap.widthInPixels;
        const mapHeight = this.mapData.tilemap.heightInPixels;
        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);

        // Create player using new feature-first architecture
        this.player = createPlayer({
            scene: this,
            x: 2200,
            y: 0,
            texture: "soldier",
        });

        this.player.setScale(PLAYER_CONFIG.movement.scale);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(
            PLAYER_CONFIG.movement.hitboxWidth,
            PLAYER_CONFIG.movement.hitboxHeight
        );
        
        // Set player depth to render above all other entities
        this.player.setDepth(10); // Higher than enemies (depth 5)

        // Set camera to follow player
        this.cameras.main.startFollow(this.player);

        // Set camera bounds to match tilemap dimensions
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        // Set database connection on player's systems if connection exists
        const dbConnection = this.dbConnectionManager.getConnection();
        if (dbConnection) {
            this.setupPlayerSystems(dbConnection);
        }

        // Set up map-based collisions
        const groundGroup = this.mapLoader.createPhysicsFromGround(
            this.mapData.ground
        );
        const platformGroup = this.mapLoader.createPhysicsFromPlatforms(
            this.mapData.platforms
        );
        const climbeableGroup = this.mapLoader.createClimbeablePhysics(
            this.mapData.climbeable
        );
        const boundaryGroup = this.mapLoader.createBoundaryPhysics(
            this.mapData.boundaries
        );

        // Add collision between player and ground (traditional solid collision)
        this.physics.add.collider(this.player, groundGroup);

        // Add one-way collision between player and platforms (can jump through from below)
        this.physics.add.collider(
            this.player,
            platformGroup,
            undefined,
            (player: any, platform: any) => {
                const playerBody = player.body as Phaser.Physics.Arcade.Body;
                const platformBody =
                    platform.body as Phaser.Physics.Arcade.StaticBody;

                // Only allow collision if player is coming from above (falling down)
                return (
                    playerBody.velocity.y > 0 && playerBody.y < platformBody.y
                );
            }
        );

        // Add collision between player and boundaries
        this.physics.add.collider(this.player, boundaryGroup);

        // Add overlap for climbeable interaction (pass-through, no collision)
        this.physics.add.overlap(this.player, climbeableGroup, () => {
            // Climbeable interaction will be handled by ClimbingSystem
            // Player can pass through climbeable surfaces
        });

        // Configure player climbing system with map data
        const climbingSystem = this.player.getSystem("climbing");
        if (climbingSystem) {
            (climbingSystem as any).setClimbeableGroup(climbeableGroup);
        }

        // Initialize enemy manager
        this.enemyManager = new EnemyManager(this);

        // Set database connection if already available
        const dbConn = this.dbConnectionManager.getConnection();
        if (dbConn) {
            this.enemyManager.setDbConnection(dbConn);
        }

        // Get combat system for attack collision
        const combatSystem = this.player.getSystem("combat");

        // Set up attack collision detection with enemies
        if (combatSystem) {
            this.physics.add.overlap(
                (combatSystem as any).getHitboxSprite(),
                this.enemyManager.getEnemyGroup(),
                this.onAttackHitEnemy,
                undefined,
                this
            );
        }

        // Set up enemy collision with ground, platforms, and boundaries
        this.physics.add.collider(
            this.enemyManager.getEnemyGroup(),
            groundGroup
        );
        this.physics.add.collider(
            this.enemyManager.getEnemyGroup(),
            platformGroup,
            undefined,
            (enemy: any, platform: any) => {
                const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
                const platformBody =
                    platform.body as Phaser.Physics.Arcade.StaticBody;

                // Only allow collision if enemy is coming from above (falling down)
                return enemyBody.velocity.y > 0 && enemyBody.y < platformBody.y;
            }
        );
        this.physics.add.collider(
            this.enemyManager.getEnemyGroup(),
            boundaryGroup
        );

        // Set up player-enemy collision for hurt animation
        this.physics.add.overlap(
            this.player,
            this.enemyManager.getEnemyGroup(),
            this.onPlayerTouchEnemy,
            undefined,
            this
        );
    }

    private onAttackHitEnemy = (_hitbox: any, enemy: any): void => {
        // Visual feedback for successful hit
        this.cameras.main.shake(CAMERA_SHAKE_DURATION, CAMERA_SHAKE_INTENSITY);

        // Get enemy ID from sprite and play hit animation
        const enemyId = this.enemyManager.getEnemyIdFromSprite(enemy);
        if (enemyId !== null) {
            this.enemyManager.playHitAnimation(enemyId);
            console.log('Enemy hit!', enemyId);
            // TODO: Call server reducer to damage/destroy enemy
        }
    };

    private handleDatabaseConnect(conn: DbConnection, identity: Identity, _token: string): void {
        // Set up player systems if player exists
        if (this.player) {
            this.setupPlayerSystems(conn);
        }

        // Initialize peer manager
        this.peerManager = new PeerManager(this);
        this.peerManager.setLocalPlayerIdentity(identity);

        // Set up peer event handlers
        conn.db.player.onInsert(this.peerManager.onPlayerInsert);
        conn.db.player.onUpdate(this.peerManager.onPlayerUpdate);
        conn.db.player.onDelete(this.peerManager.onPlayerDelete);

        // Set database connection on enemy manager if it exists
        if (this.enemyManager) {
            this.enemyManager.setDbConnection(conn);
        }
    }

    private setupPlayerSystems(conn: DbConnection): void {
        const movementSystem = this.player.getSystem("movement") as any;
        if (movementSystem && movementSystem.setDbConnection) {
            movementSystem.setDbConnection(conn);
        }

        const combatSystem = this.player.getSystem("combat") as any;
        if (combatSystem && combatSystem.setSyncManager) {
            // Get the sync manager from movement system
            const syncManager = movementSystem.syncManager;
            combatSystem.setSyncManager(syncManager);
        }
    }

    private onPlayerTouchEnemy = (player: any, enemy: any): void => {
        // Calculate knockback direction (away from enemy)
        const playerPos = { x: player.x, y: player.y };
        const enemyPos = { x: enemy.x, y: enemy.y };
        
        // Calculate direction from enemy to player (away from enemy)
        const deltaX = playerPos.x - enemyPos.x;
        const deltaY = playerPos.y - enemyPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Normalize direction (prevent division by zero)
        const knockbackDirection = {
            x: distance > 0 ? deltaX / distance : 1, // Default right if same position
            y: distance > 0 ? deltaY / distance : 0
        };
        
        // Get the animation system and check/trigger hurt animation with knockback
        const animationSystem = this.player.getSystem("animations") as any;
        if (animationSystem && animationSystem.playHurtAnimation) {
            // Only trigger hurt if not already invulnerable
            const wasHurt = animationSystem.playHurtAnimation(knockbackDirection);
            if (wasHurt) {
                console.log('Player hurt by enemy! Knockback direction:', knockbackDirection);
                // TODO: Call server reducer to damage player
            }
        }
    };

    update(time: number, delta: number): void {
        // Update player (which handles all its systems)
        this.player.update(time, delta);

        // Enemy manager doesn't need updates (server-driven)

        // Update peer system for smooth interpolation
        if (this.peerManager) {
            this.peerManager.update();
        }
    }

    // Debug methods
    renderDebug(graphics: Phaser.GameObjects.Graphics): void {
        if (!DebugState.getInstance().enabled || !this.player) return;

        this.drawNearbyCollisionBoundaries(graphics);
        this.drawAllObjectHitboxes(graphics);
    }

    private drawNearbyCollisionBoundaries(
        graphics: Phaser.GameObjects.Graphics
    ): void {
        const playerX = this.player.x;
        const playerY = this.player.y;
        const checkRadius = DEBUG_CONFIG.ui.collisionCheckRadius;

        // Set style for collision boundaries
        graphics.lineStyle(2, DEBUG_CONFIG.colors.collision, 0.8);

        // Get all physics bodies in the world
        const bodies = this.physics.world.staticBodies.entries;

        for (const body of bodies) {
            // Only draw bodies near the player
            const distance = Phaser.Math.Distance.Between(
                playerX,
                playerY,
                body.x + body.halfWidth,
                body.y + body.halfHeight
            );

            if (distance < checkRadius) {
                // Draw collision boundary rectangle
                graphics.strokeRect(body.x, body.y, body.width, body.height);
            }
        }
    }

    private drawAllObjectHitboxes(graphics: Phaser.GameObjects.Graphics): void {
        const playerX = this.player.x;
        const playerY = this.player.y;
        const checkRadius = DEBUG_CONFIG.ui.collisionCheckRadius;

        // Set style for object hitboxes
        graphics.lineStyle(2, 0xff0000, 0.7); // Red color for enemy hitboxes

        // Draw enemy hitboxes
        this.enemyManager.getEnemyGroup().children.entries.forEach((enemy) => {
            const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            if (enemySprite.body) {
                const body = enemySprite.body as Phaser.Physics.Arcade.Body;
                const distance = Phaser.Math.Distance.Between(
                    playerX,
                    playerY,
                    enemySprite.x,
                    enemySprite.y
                );

                if (distance < checkRadius) {
                    // Draw enemy hitbox
                    graphics.strokeRect(
                        body.x,
                        body.y,
                        body.width,
                        body.height
                    );

                    // Draw center point
                    graphics.fillStyle(0xff0000, 0.8);
                    graphics.fillCircle(enemySprite.x, enemySprite.y, 2);
                }
            }
        });

        // Draw all dynamic bodies (non-player entities)
        graphics.lineStyle(1, 0xffff00, 0.5); // Yellow for other dynamic bodies

        // Get combat system to check for attack hitbox
        const combatSystem = this.player.getSystem("combat");
        const attackHitbox = combatSystem
            ? (combatSystem as any).getHitboxSprite().body
            : null;

        this.physics.world.bodies.entries.forEach((body) => {
            // Skip player body (it's handled by Player class)
            if (body === this.player.body) return;

            // Skip attack hitbox (it's handled by Combat system)
            if (attackHitbox && body === attackHitbox) return;

            const distance = Phaser.Math.Distance.Between(
                playerX,
                playerY,
                body.x + body.halfWidth,
                body.y + body.halfHeight
            );

            if (distance < checkRadius) {
                graphics.strokeRect(body.x, body.y, body.width, body.height);
            }
        });
    }

    getDebugInfo(): Record<string, any> {
        if (!DebugState.getInstance().enabled) return {};

        const staticBodies = this.physics.world.staticBodies.entries.length;
        const dynamicBodies = this.physics.world.bodies.entries.length;

        return {
            staticBodies,
            dynamicBodies,
            totalBodies: staticBodies + dynamicBodies,
            mapSize: this.mapData
                ? `${this.mapData.tilemap.widthInPixels}x${this.mapData.tilemap.heightInPixels}`
                : "N/A",
            peers: this.peerManager ? this.peerManager.getPeerCount() : 0,
        };
    }

    isDebugEnabled(): boolean {
        return DebugState.getInstance().enabled;
    }

    shutdown(): void {
        // Clean up peer manager
        if (this.peerManager) {
            this.peerManager.destroy();
        }
    }
}
