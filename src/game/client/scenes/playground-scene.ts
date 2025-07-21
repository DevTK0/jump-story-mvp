import Phaser from "phaser";
import { createPlayer, Player } from "../features/player";
import { EnemyManager, DEFAULT_SPAWN_CONFIG } from "../features/enemy";
import { MapLoader, type MapData } from "../features/stage";
import { PeerManager } from "../features/peers";
import { PLAYER_CONFIG } from "../features/player";
import type { IDebuggable } from "../features/debug/debug-interfaces";
import { DEBUG_CONFIG } from "../features/debug/config";
import { DebugState } from "../features/debug/debug-state";

import {
    DbConnection,
    type ErrorContext,
    type SubscriptionEventContext,
} from "../module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

// Scene-specific constants
const COLOR_BACKGROUND = 0x2c3e50;
const SPRITE_FRAME_WIDTH = 100;
const SPRITE_FRAME_HEIGHT = 100;
const CAMERA_SHAKE_DURATION = 100;
const CAMERA_SHAKE_INTENSITY = 0.03;

export class PlaygroundScene extends Phaser.Scene implements IDebuggable {
    private player!: Player;
    private identity!: Identity;
    private dbConnection!: DbConnection;

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
        const onConnect = (
            conn: DbConnection,
            identity: Identity,
            token: string
        ) => {
            this.identity = identity;
            this.dbConnection = conn;
            localStorage.setItem("auth_token", token);
            console.log(
                "Connected to SpacetimeDB with identity:",
                identity.toHexString()
            );

            conn.subscriptionBuilder()
                .onApplied(handleSubscriptionApplied)
                .subscribeToAllTables();
                
            // Set database connection on player's movement system if it exists
            if (this.player) {
                const movementSystem = this.player.getSystem('movement') as any;
                if (movementSystem && movementSystem.setDbConnection) {
                    movementSystem.setDbConnection(conn);
                }
            }
            
            // Initialize peer manager and set up player table event handlers
            this.peerManager = new PeerManager(this);
            this.peerManager.setLocalPlayerIdentity(identity);
            
            // Set up peer event handlers
            conn.db.player.onInsert(this.peerManager.onPlayerInsert);
            conn.db.player.onUpdate(this.peerManager.onPlayerUpdate);
            conn.db.player.onDelete(this.peerManager.onPlayerDelete);
        };

        const handleSubscriptionApplied = (_ctx: SubscriptionEventContext) => {
            console.log("Subscription applied!");
        };

        const onDisconnect = () => {
            console.log("Disconnected from SpacetimeDB");
        };

        const onConnectError = (_ctx: ErrorContext, err: Error) => {
            console.log("Error connecting to SpacetimeDB:", err);
        };

        DbConnection.builder()
            .withUri("ws://localhost:3000")
            .withModuleName("jump-story")
            .onConnect(onConnect)
            .onDisconnect(onDisconnect)
            .onConnectError(onConnectError)
            .build();

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

        // Set camera to follow player
        this.cameras.main.startFollow(this.player);

        // Set camera bounds to match tilemap dimensions
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        
        // Set database connection on player's movement system if connection exists
        if (this.dbConnection) {
            const movementSystem = this.player.getSystem('movement') as any;
            if (movementSystem && movementSystem.setDbConnection) {
                movementSystem.setDbConnection(this.dbConnection);
            }
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
        this.enemyManager = new EnemyManager(
            this,
            this.player,
            DEFAULT_SPAWN_CONFIG
        );

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
    }

    private onAttackHitEnemy = (_hitbox: any, enemy: any): void => {
        // Visual feedback for successful hit
        this.cameras.main.shake(CAMERA_SHAKE_DURATION, CAMERA_SHAKE_INTENSITY);

        // Destroy the enemy
        this.enemyManager.destroyEnemy(enemy);
    };

    update(time: number, delta: number): void {
        // Update player (which handles all its systems)
        this.player.update(time, delta);

        // Update enemy system
        this.enemyManager.update();
        
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
