import Phaser from 'phaser';
import { AssetResolver } from './asset-resolver';

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
    // Load map JSON from appropriate location
    const mapPath = AssetResolver.getMapPath('playground.tmj');

    this.scene.load.tilemapTiledJSON('playground', mapPath);

    // Load tileset images
    this.scene.load.image(
      'ground-tiles',
      AssetResolver.getAssetPath('assets/textures/TX Tileset Ground.png')
    );
    this.scene.load.image(
      'village-props',
      AssetResolver.getAssetPath('assets/textures/TX Village Props.png')
    );
  }

  public createMap(): MapData {
    // Create tilemap from JSON
    const tilemap = this.scene.make.tilemap({ key: 'playground' });

    // Add tilesets with correct image keys
    const groundTileset = tilemap.addTilesetImage('TX Tileset Ground', 'ground-tiles');
    const propsTileset = tilemap.addTilesetImage('TX Village Props', 'village-props');

    // Create layers (order matters for rendering)
    const groundLayer = tilemap.createLayer('Ground', [groundTileset!, propsTileset!]);
    tilemap.createLayer('Props', propsTileset!);
    tilemap.createLayer('Chests', propsTileset!);
    tilemap.createLayer('Platform', [groundTileset!, propsTileset!]);
    tilemap.createLayer('Climbeable', propsTileset!);

    // Set collision for ground tiles (exclude empty tiles with ID 0) - Traditional solid collision
    if (groundLayer) {
      groundLayer.setCollisionByExclusion([0]);
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
    const groundLayer = tilemap.getObjectLayer('Ground');

    if (groundLayer) {
      groundLayer.objects.forEach((obj) => {
        if (obj.rectangle) {
          ground.push({
            x: obj.x!,
            y: obj.y!,
            width: obj.width!,
            height: obj.height!,
            name: obj.name || 'Ground',
          });
        }
      });
    }

    return ground;
  }

  private extractPlatforms(tilemap: Phaser.Tilemaps.Tilemap): MapPlatform[] {
    const platforms: MapPlatform[] = [];

    // Find platform object layer
    const platformLayer = tilemap.getObjectLayer('Platform');

    if (platformLayer) {
      platformLayer.objects.forEach((obj) => {
        if (obj.rectangle) {
          platforms.push({
            x: obj.x!,
            y: obj.y!,
            width: obj.width!,
            height: obj.height!,
            name: obj.name || 'Platform',
          });
        }
      });
    }

    return platforms;
  }

  private extractClimbeable(tilemap: Phaser.Tilemaps.Tilemap): MapClimbeable[] {
    const climbeable: MapClimbeable[] = [];

    // Find climbeable object layer
    const climbeableLayer = tilemap.getObjectLayer('Climbeable');

    if (climbeableLayer) {
      climbeableLayer.objects.forEach((obj) => {
        if (obj.rectangle) {
          climbeable.push({
            x: obj.x!,
            y: obj.y!,
            width: obj.width!,
            height: obj.height!,
            name: obj.name || 'Climbeable',
          });
        }
      });
    }

    return climbeable;
  }

  private extractBoundaries(tilemap: Phaser.Tilemaps.Tilemap): MapBoundary[] {
    const boundaries: MapBoundary[] = [];

    // Find boundary object layer
    const boundaryLayer = tilemap.getObjectLayer('Boundary');

    if (boundaryLayer) {
      boundaryLayer.objects.forEach((obj) => {
        if (obj.rectangle) {
          boundaries.push({
            x: obj.x!,
            y: obj.y!,
            width: obj.width!,
            height: obj.height!,
            name: obj.name || 'Boundary',
          });
        }
      });
    }

    return boundaries;
  }

  private extractChests(tilemap: Phaser.Tilemaps.Tilemap): MapChest[] {
    const chests: MapChest[] = [];

    // Find chests object layer
    const chestsLayer = tilemap.getObjectLayer('Chests');

    if (chestsLayer) {
      chestsLayer.objects.forEach((obj) => {
        if (obj.rectangle) {
          // Extract the type property if it exists
          const typeProperty = obj.properties?.find((prop: any) => prop.name === 'type');
          const type = typeProperty?.value || 'chest';

          chests.push({
            x: obj.x!,
            y: obj.y!,
            width: obj.width!,
            height: obj.height!,
            name: obj.name || 'Chest',
            type: type,
          });
        }
      });
    }

    return chests;
  }


  public destroy(): void {
    // Cleanup if needed
  }
}
