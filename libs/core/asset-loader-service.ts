import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from './logger';
import { MapLoader, type MapData } from '@/stage';
import { AnimationFactory, type AnimationFrameConfig, type SpriteAnimationSet } from '@/animations';
import { SpriteConfigLoader } from './sprite-config-loader';
import { AssetResolver } from './asset-resolver';
import { ErrorBoundary, AssetError } from './error-boundary';
import { DISPLAY_CONFIG } from './display-config';
import spriteConfig from '../../apps/playground/config/sprite-config.json';

/**
 * Service responsible for loading and managing scene assets
 */
export class AssetLoaderService {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  private mapLoader: MapLoader;
  private errorBoundary: ErrorBoundary;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('AssetLoaderService');
    this.mapLoader = new MapLoader(scene);
    this.errorBoundary = ErrorBoundary.getInstance();
  }
  
  /**
   * Load all required assets for the scene
   */
  loadSceneAssets(): void {
    this.logger.info('Loading scene assets...');
    
    // Setup error handling
    this.setupErrorHandling();
    
    // Load map assets
    this.loadMapAssets();
    
    // Load sprite sheets
    this.loadSpriteSheets();
    
    // Load emotes dynamically from config
    this.loadEmotes();
  }
  
  /**
   * Create map from loaded assets
   */
  createMap(): MapData {
    this.logger.debug('Creating map from loaded assets');
    return this.mapLoader.createMap();
  }
  
  /**
   * Create all animations from sprite config
   */
  createAllAnimations(): void {
    this.logger.info('Creating animations from sprite config');
    
    const animFactory = new AnimationFactory(this.scene);
    const configLoader = new SpriteConfigLoader();
    
    // Load sprite configuration
    configLoader.setConfig(spriteConfig);
    
    // Get all animation definitions from the config
    const animationDefinitions = configLoader.getAllAnimationDefinitions();
    
    // Register and create animations for each sprite
    Object.entries(animationDefinitions).forEach(([spriteKey, animations]) => {
      // Check if this is a regular sprite animation (has idle and walk) or an emote
      if ('idle' in animations && 'walk' in animations) {
        // Regular sprite with full animation set
        animFactory.registerSpriteAnimations(spriteKey, animations as SpriteAnimationSet);
        animFactory.createSpriteAnimations(spriteKey);
      } else if ('play' in animations) {
        // Emote animations - create manually
        const emoteAnim = animations as { play: AnimationFrameConfig & { frameRate: number } };
        this.scene.anims.create({
          key: `${spriteKey}_anim`,
          frames: this.scene.anims.generateFrameNumbers(spriteKey, {
            start: emoteAnim.play.start,
            end: emoteAnim.play.end,
          }),
          frameRate: emoteAnim.play.frameRate,
          repeat: -1, // Loop forever
        });
      }
    });
    
    this.logger.info('Created all game animations from sprite config');
  }
  
  private setupErrorHandling(): void {
    // Add error handler for asset loading
    this.scene.load.on('loaderror', (file: any) => {
      this.errorBoundary.handleError(
        new AssetError(`Failed to load asset: ${file.key}`, {
          scene: this.scene,
          system: 'loader',
          action: 'load-asset',
          metadata: { file },
        })
      );
    });
  }
  
  private loadMapAssets(): void {
    this.mapLoader.loadMapAssets();
  }
  
  private loadSpriteSheets(): void {
    // Load character sprites
    this.loadSpriteSheet('soldier', 'assets/spritesheet/classes/Soldier.png');
    this.loadSpriteSheet('orc', 'assets/spritesheet/enemies/Orc.png');
  }
  
  private loadSpriteSheet(key: string, path: string): void {
    this.scene.load.spritesheet(
      key,
      AssetResolver.getAssetPath(path),
      {
        frameWidth: DISPLAY_CONFIG.sprite.defaultFrameWidth,
        frameHeight: DISPLAY_CONFIG.sprite.defaultFrameHeight,
      }
    );
  }
  
  private loadEmotes(): void {
    // Get emotes from sprite config
    const configLoader = new SpriteConfigLoader();
    configLoader.setConfig(spriteConfig);
    
    
    // Load emotes based on sprite config structure
    if (spriteConfig.sprites.emotes) {
      Object.entries(spriteConfig.sprites.emotes).forEach(([emoteName, emoteConfig]) => {
        if (emoteConfig.path && emoteConfig.frameWidth && emoteConfig.frameHeight) {
          // Convert emote name to key format (e.g., exclamation -> exclamation_emote)
          const key = `${emoteName}_emote`;
          
          this.scene.load.spritesheet(
            key,
            AssetResolver.getAssetPath(emoteConfig.path),
            {
              frameWidth: emoteConfig.frameWidth,
              frameHeight: emoteConfig.frameHeight,
            }
          );
          
          this.logger.debug(`Loading emote: ${key} from ${emoteConfig.path}`);
        }
      });
    }
  }
}