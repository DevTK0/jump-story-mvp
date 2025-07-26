import Phaser from 'phaser';
import type { MapGround, MapPlatform, MapClimbeable, MapBoundary } from '@/core/asset/map-loader';

/**
 * Factory for creating physics bodies from map data.
 * Extracted from MapLoader to follow Single Responsibility Principle.
 * 
 * This class is responsible only for creating physics bodies,
 * not for loading map assets.
 */
export class MapPhysicsFactory {
  /**
   * Create physics bodies for ground objects.
   * Ground has solid collision from all directions.
   */
  static createPhysicsFromGround(
    scene: Phaser.Scene,
    ground: MapGround[]
  ): Phaser.Physics.Arcade.StaticGroup {
    const groundGroup = scene.physics.add.staticGroup();

    ground.forEach((groundRect) => {
      // Create invisible rectangle for ground physics
      const rect = scene.add.rectangle(
        groundRect.x + groundRect.width / 2,
        groundRect.y + groundRect.height / 2,
        groundRect.width,
        groundRect.height,
        0x654321, // Color (invisible)
        0.0 // Invisible
      );

      // Add physics body
      scene.physics.add.existing(rect, true);

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

  /**
   * Create physics bodies for platform objects.
   * Platforms are one-way (can only collide from above).
   */
  static createPhysicsFromPlatforms(
    scene: Phaser.Scene,
    platforms: MapPlatform[]
  ): Phaser.Physics.Arcade.StaticGroup {
    const platformGroup = scene.physics.add.staticGroup();

    platforms.forEach((platform) => {
      // Create invisible rectangle for platform physics
      const rect = scene.add.rectangle(
        platform.x + platform.width / 2,
        platform.y + platform.height / 2,
        platform.width,
        platform.height,
        0x8b4513, // Color (invisible)
        0.0 // Invisible
      );

      // Add physics body
      scene.physics.add.existing(rect, true);

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

  /**
   * Create physics bodies for climbeable objects.
   * Climbeable objects are pass-through (no collision, only overlap detection).
   */
  static createClimbeablePhysics(
    scene: Phaser.Scene,
    climbeable: MapClimbeable[]
  ): Phaser.Physics.Arcade.StaticGroup {
    const climbeableGroup = scene.physics.add.staticGroup();

    climbeable.forEach((climb) => {
      // Create invisible rectangle for climbeable physics
      const rect = scene.add.rectangle(
        climb.x + climb.width / 2,
        climb.y + climb.height / 2,
        climb.width,
        climb.height,
        0x00ff00, // Color (invisible)
        0.0 // Invisible
      );

      // Add physics body
      scene.physics.add.existing(rect, true);

      // Set climbeable as pass-through (no collision, only overlap detection)
      const body = rect.body as Phaser.Physics.Arcade.StaticBody;
      if (body) {
        body.checkCollision.none = true; // No collision from any direction
      }

      climbeableGroup.add(rect);
    });

    return climbeableGroup;
  }

  /**
   * Create physics bodies for boundary objects.
   * Boundaries are solid walls that prevent entities from leaving the map.
   */
  static createBoundaryPhysics(
    scene: Phaser.Scene,
    boundaries: MapBoundary[]
  ): Phaser.Physics.Arcade.StaticGroup {
    const boundaryGroup = scene.physics.add.staticGroup();

    boundaries.forEach((boundary) => {
      // Create invisible rectangle for boundary physics
      const rect = scene.add.rectangle(
        boundary.x + boundary.width / 2,
        boundary.y + boundary.height / 2,
        boundary.width,
        boundary.height,
        0xff0000, // Color (invisible)
        0.0 // Invisible
      );

      // Add physics body
      scene.physics.add.existing(rect, true);
      boundaryGroup.add(rect);
    });

    return boundaryGroup;
  }

  /**
   * Create all collision groups from map data.
   * Returns an object with all physics groups.
   */
  static createAllCollisionGroups(
    scene: Phaser.Scene,
    mapData: {
      ground: MapGround[];
      platforms: MapPlatform[];
      climbeable: MapClimbeable[];
      boundaries: MapBoundary[];
    }
  ): {
    ground: Phaser.Physics.Arcade.StaticGroup;
    platforms: Phaser.Physics.Arcade.StaticGroup;
    climbeable: Phaser.Physics.Arcade.StaticGroup;
    boundaries: Phaser.Physics.Arcade.StaticGroup;
  } {
    return {
      ground: this.createPhysicsFromGround(scene, mapData.ground),
      platforms: this.createPhysicsFromPlatforms(scene, mapData.platforms),
      climbeable: this.createClimbeablePhysics(scene, mapData.climbeable),
      boundaries: this.createBoundaryPhysics(scene, mapData.boundaries),
    };
  }
}