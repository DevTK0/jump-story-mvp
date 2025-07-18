import Phaser from "phaser";

export interface MapGround {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
}

export interface MapPlatform {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
}

export interface MapClimbeable {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
}

export interface MapBoundary {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
}

export interface MapChest {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    type: string;
}

export interface MapData {
    ground: MapGround[];
    platforms: MapPlatform[];
    climbeable: MapClimbeable[];
    boundaries: MapBoundary[];
    chests: MapChest[];
    tilemap: Phaser.Tilemaps.Tilemap;
}

export class MapLoader {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public loadMapAssets(): void {
        // Load map JSON
        this.scene.load.tilemapTiledJSON(
            "playground",
            "assets/maps/playground.tmj"
        );

        // Load tileset images
        this.scene.load.image(
            "ground-tiles",
            "assets/textures/TX Tileset Ground.png"
        );
        this.scene.load.image(
            "village-props",
            "assets/textures/TX Village Props.png"
        );
    }

    public createMap(): MapData {
        // Create tilemap from JSON
        const tilemap = this.scene.make.tilemap({ key: "playground" });

        // Add tilesets with correct image keys
        const groundTileset = tilemap.addTilesetImage(
            "TX Tileset Ground",
            "ground-tiles"
        );
        const propsTileset = tilemap.addTilesetImage(
            "TX Village Props",
            "village-props"
        );

        // Create layers (order matters for rendering)
        const groundLayer = tilemap.createLayer("Ground", [
            groundTileset!,
            propsTileset!,
        ]);
        tilemap.createLayer("Props", propsTileset!);
        tilemap.createLayer("Chests", propsTileset!);
        const platformLayer = tilemap.createLayer("Platform", propsTileset!);
        const climbeableLayer = tilemap.createLayer("Climbeable", propsTileset!);
        
        // Add color tints to distinguish different layer types
        if (platformLayer) {
            platformLayer.setTint(0xDEB887); // Burlywood tint for platform tiles
        }
        if (climbeableLayer) {
            climbeableLayer.setTint(0x90EE90); // Light green tint for climbeable tiles
        }

        // Set collision for ground tiles (exclude empty tiles with ID 0) - Traditional solid collision
        if (groundLayer) {
            groundLayer.setCollisionByExclusion([0]);
            // Add color tint to ground tiles to distinguish them from platforms
            groundLayer.setTint(0x8B4513); // Brown tint for ground tiles
        }

        // Platform tiles will be handled as one-way platforms (no tile collision, object-based only)
        // Climbeable tiles will be handled as pass-through (no tile collision, object-based only)

        // Extract collision objects from the map
        const ground = this.extractGround(tilemap);
        const platforms = this.extractPlatforms(tilemap);
        const climbeable = this.extractClimbeable(tilemap);
        const boundaries = this.extractBoundaries(tilemap);
        const chests = this.extractChests(tilemap);

        return {
            ground,
            platforms,
            climbeable,
            boundaries,
            chests,
            tilemap,
        };
    }

    private extractGround(tilemap: Phaser.Tilemaps.Tilemap): MapGround[] {
        const ground: MapGround[] = [];

        // Find ground object layer
        const groundLayer = tilemap.getObjectLayer("Ground");

        if (groundLayer) {
            groundLayer.objects.forEach((obj) => {
                if (obj.rectangle) {
                    ground.push({
                        x: obj.x!,
                        y: obj.y!,
                        width: obj.width!,
                        height: obj.height!,
                        name: obj.name || "Ground",
                    });
                }
            });
        }

        return ground;
    }

    private extractPlatforms(tilemap: Phaser.Tilemaps.Tilemap): MapPlatform[] {
        const platforms: MapPlatform[] = [];

        // Find platform object layer
        const platformLayer = tilemap.getObjectLayer("Platform");

        if (platformLayer) {
            platformLayer.objects.forEach((obj) => {
                if (obj.rectangle) {
                    platforms.push({
                        x: obj.x!,
                        y: obj.y!,
                        width: obj.width!,
                        height: obj.height!,
                        name: obj.name || "Platform",
                    });
                }
            });
        }

        return platforms;
    }

    private extractClimbeable(
        tilemap: Phaser.Tilemaps.Tilemap
    ): MapClimbeable[] {
        const climbeable: MapClimbeable[] = [];

        // Find climbeable object layer
        const climbeableLayer = tilemap.getObjectLayer("Climbeable");

        if (climbeableLayer) {
            climbeableLayer.objects.forEach((obj) => {
                if (obj.rectangle) {
                    climbeable.push({
                        x: obj.x!,
                        y: obj.y!,
                        width: obj.width!,
                        height: obj.height!,
                        name: obj.name || "Climbeable",
                    });
                }
            });
        }

        return climbeable;
    }

    private extractBoundaries(tilemap: Phaser.Tilemaps.Tilemap): MapBoundary[] {
        const boundaries: MapBoundary[] = [];

        // Find boundary object layer
        const boundaryLayer = tilemap.getObjectLayer("Boundary");

        if (boundaryLayer) {
            boundaryLayer.objects.forEach((obj) => {
                if (obj.rectangle) {
                    boundaries.push({
                        x: obj.x!,
                        y: obj.y!,
                        width: obj.width!,
                        height: obj.height!,
                        name: obj.name || "Boundary",
                    });
                }
            });
        }

        return boundaries;
    }

    private extractChests(tilemap: Phaser.Tilemaps.Tilemap): MapChest[] {
        const chests: MapChest[] = [];

        // Find chests object layer
        const chestsLayer = tilemap.getObjectLayer("Chests");

        if (chestsLayer) {
            chestsLayer.objects.forEach((obj) => {
                if (obj.rectangle) {
                    // Extract the type property if it exists
                    const typeProperty = obj.properties?.find(
                        (prop: any) => prop.name === "type"
                    );
                    const type = typeProperty?.value || "chest";

                    chests.push({
                        x: obj.x!,
                        y: obj.y!,
                        width: obj.width!,
                        height: obj.height!,
                        name: obj.name || "Chest",
                        type: type,
                    });
                }
            });
        }

        return chests;
    }

    public createPhysicsFromGround(
        ground: MapGround[]
    ): Phaser.Physics.Arcade.StaticGroup {
        const groundGroup = this.scene.physics.add.staticGroup();

        ground.forEach((groundRect) => {
            // Create visible rectangle for ground (dark brown color)
            const rect = this.scene.add.rectangle(
                groundRect.x + groundRect.width / 2,
                groundRect.y + groundRect.height / 2,
                groundRect.width,
                groundRect.height,
                0x654321, // Dark brown color
                0.7 // Semi-visible for debugging
            );

            // Add physics body
            this.scene.physics.add.existing(rect, true);
            
            // Ground has solid collision from all directions
            const body = rect.body as Phaser.Physics.Arcade.StaticBody;
            if (body) {
                body.checkCollision.up = true;
                body.checkCollision.down = true;
                body.checkCollision.left = true;
                body.checkCollision.right = true;
            }
            
            groundGroup.add(rect);
        });

        return groundGroup;
    }

    public createPhysicsFromPlatforms(
        platforms: MapPlatform[]
    ): Phaser.Physics.Arcade.StaticGroup {
        const platformGroup = this.scene.physics.add.staticGroup();

        platforms.forEach((platform) => {
            // Create visible rectangle for platform (brown color)
            const rect = this.scene.add.rectangle(
                platform.x + platform.width / 2,
                platform.y + platform.height / 2,
                platform.width,
                platform.height,
                0x8b4513, // Brown color
                0.5 // Visible
            );

            // Add physics body
            this.scene.physics.add.existing(rect, true);

            // Set platform as one-way (can only collide from above)
            const body = rect.body as Phaser.Physics.Arcade.StaticBody;
            if (body) {
                body.checkCollision.down = false;
                body.checkCollision.left = false;
                body.checkCollision.right = false;
                body.checkCollision.up = true; // Only collide from above
            }

            platformGroup.add(rect);
        });

        return platformGroup;
    }

    public createClimbeablePhysics(
        climbeable: MapClimbeable[]
    ): Phaser.Physics.Arcade.StaticGroup {
        const climbeableGroup = this.scene.physics.add.staticGroup();

        climbeable.forEach((climb) => {
            // Create visible rectangle for climbeable (green color, semi-transparent)
            const rect = this.scene.add.rectangle(
                climb.x + climb.width / 2,
                climb.y + climb.height / 2,
                climb.width,
                climb.height,
                0x00ff00, // Green color
                0.3 // Semi-transparent
            );

            // Add physics body
            this.scene.physics.add.existing(rect, true);

            // Set climbeable as pass-through (no collision, only overlap detection)
            const body = rect.body as Phaser.Physics.Arcade.StaticBody;
            if (body) {
                body.checkCollision.none = true; // No collision from any direction
            }

            climbeableGroup.add(rect);
        });

        return climbeableGroup;
    }

    public createBoundaryPhysics(
        boundaries: MapBoundary[]
    ): Phaser.Physics.Arcade.StaticGroup {
        const boundaryGroup = this.scene.physics.add.staticGroup();

        boundaries.forEach((boundary) => {
            // Create invisible rectangle for boundary (no color, invisible)
            const rect = this.scene.add.rectangle(
                boundary.x + boundary.width / 2,
                boundary.y + boundary.height / 2,
                boundary.width,
                boundary.height,
                0xff0000, // Red color (for debug)
                0.2 // Semi-transparent
            );

            // Add physics body
            this.scene.physics.add.existing(rect, true);
            boundaryGroup.add(rect);
        });

        return boundaryGroup;
    }

    public destroy(): void {
        // Cleanup if needed
    }
}