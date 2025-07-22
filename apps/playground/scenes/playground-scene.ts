import Phaser from "phaser";
import { Player, PlayerBuilder } from "@/player";
import { EnemyManager } from "@/enemy";
import { MapLoader, type MapData } from "@/stage";
import { PeerManager } from "@/peer";
import { PLAYER_CONFIG } from "@/player";
import type { IDebuggable } from "@/debug/debug-interfaces";
import { DEBUG_CONFIG } from "@/debug/config";
import { DebugState } from "@/debug/debug-state";
import { SpacetimeConnectionBuilder } from "@/networking";
import { PhysicsConfigurator, type CollisionGroups } from "@/physics";
import { InteractionHandler } from "@/networking";
import { DbConnection } from "@/spacetime/client";
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
    private dbConnectionManager!: import("@/networking").SpacetimeConnector;

    // System managers
    private enemyManager!: EnemyManager;
    private mapLoader!: MapLoader;
    private mapData!: MapData;
    private peerManager!: PeerManager;
    private physicsConfigurator!: PhysicsConfigurator;
    private interactionHandler!: InteractionHandler;

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
        // Initialize database connection manager using Builder pattern
        this.dbConnectionManager = new SpacetimeConnectionBuilder()
            .setUri("ws://localhost:3000")
            .setModuleName("jump-story")
            .onConnect(this.handleDatabaseConnect.bind(this))
            .onDisconnect(() => console.log("Disconnected from SpacetimeDB"))
            .onError((_ctx, err) => console.error("Error connecting to SpacetimeDB:", err))
            .onSubscriptionApplied((_ctx) => console.log("Subscription applied!"))
            .build();

        // Start database connection
        this.dbConnectionManager.connect().catch((err: any) => {
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

        // Create player using Builder pattern
        this.player = new PlayerBuilder(this)
            .setPosition(2200, 0)
            .setTexture("soldier")
            .withAllSystems()
            .build();

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

        // Initialize managers
        this.physicsConfigurator = new PhysicsConfigurator(this);
        this.interactionHandler = new InteractionHandler(this, {
            cameraShakeDuration: CAMERA_SHAKE_DURATION,
            cameraShakeIntensity: CAMERA_SHAKE_INTENSITY
        });

        // Create collision groups from map data
        const collisionGroups: CollisionGroups = {
            ground: this.mapLoader.createPhysicsFromGround(this.mapData.ground),
            platforms: this.mapLoader.createPhysicsFromPlatforms(this.mapData.platforms),
            climbeable: this.mapLoader.createClimbeablePhysics(this.mapData.climbeable),
            boundaries: this.mapLoader.createBoundaryPhysics(this.mapData.boundaries)
        };

        // Get systems for collision setup
        const climbingSystem = this.player.getSystem("climbing");
        const combatSystem = this.player.getSystem("combat");

        // Initialize enemy manager
        this.enemyManager = new EnemyManager(this);

        // Set database connection if already available
        const dbConn = this.dbConnectionManager.getConnection();
        if (dbConn) {
            this.enemyManager.setDbConnection(dbConn);
        }

        // Create interaction callbacks
        const interactionCallbacks = this.interactionHandler.createInteractionCallbacks(
            this.player,
            this.enemyManager
        );

        // Set up all collisions using the PhysicsConfigurator
        this.physicsConfigurator.setupAllCollisions(
            this.player,
            this.enemyManager,
            collisionGroups,
            combatSystem,
            climbingSystem,
            interactionCallbacks,
            this
        );
    }

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
