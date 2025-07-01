import Phaser from "phaser";
import { createPlayer, Player } from "../features/player";
import { EnemyManager, DEFAULT_SPAWN_CONFIG } from "../features/enemy";
import { MapLoader, type MapData } from "../features/stage";
import {
    PLAYER_SCALE,
    PLAYER_HITBOX_WIDTH,
    PLAYER_HITBOX_HEIGHT,
} from "../features/player";

// Scene-specific constants
const COLOR_BACKGROUND = 0x2c3e50;
const SPRITE_FRAME_WIDTH = 100;
const SPRITE_FRAME_HEIGHT = 100;
const CAMERA_SHAKE_DURATION = 100;
const CAMERA_SHAKE_INTENSITY = 0.03;

export class GameScene extends Phaser.Scene {
    private player!: Player;

    // System managers
    private enemyManager!: EnemyManager;
    private mapLoader!: MapLoader;
    private mapData!: MapData;

    constructor() {
        super({ key: "GameScene" });
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
        
        this.player.setScale(PLAYER_SCALE);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_HEIGHT);

        // Set camera to follow player
        this.cameras.main.startFollow(this.player);

        // Set camera bounds to match tilemap dimensions
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

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
        this.physics.add.collider(this.player, platformGroup, undefined, (player: any, platform: any) => {
            const playerBody = player.body as Phaser.Physics.Arcade.Body;
            const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;
            
            // Only allow collision if player is coming from above (falling down)
            return playerBody.velocity.y > 0 && playerBody.y < platformBody.y;
        });

        // Add collision between player and boundaries
        this.physics.add.collider(this.player, boundaryGroup);

        // Add overlap for climbeable interaction (pass-through, no collision)
        this.physics.add.overlap(this.player, climbeableGroup, () => {
            // Climbeable interaction will be handled by ClimbingSystem
            // Player can pass through climbeable surfaces
        });

        // Configure player climbing system with map data
        const climbingSystem = this.player.getSystem('climbing');
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
        const combatSystem = this.player.getSystem('combat');
        

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
                const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody;
                
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

    }
}
