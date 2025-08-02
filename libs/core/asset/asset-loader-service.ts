import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '../logger';
import { MapLoader, type MapData } from './map-loader';
import { AnimationFactory, type AnimationFrameConfig, type SpriteAnimationSet } from '../animations';
import { spriteConfigLoader, type SpriteConfig } from './sprite-config-loader';
import { audioConfigLoader, type AudioConfig } from './audio-config-loader';
import { AssetResolver } from './asset-resolver';
import { ErrorBoundary, AssetError } from '../error';

/**
 * Service responsible for loading and managing scene assets
 */
export class AssetLoaderService {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  private mapLoader: MapLoader;
  private errorBoundary: ErrorBoundary;
  private spriteConfig: SpriteConfig;
  private audioConfig?: AudioConfig;
  
  constructor(scene: Phaser.Scene, spriteConfig: SpriteConfig, audioConfig?: AudioConfig) {
    this.scene = scene;
    this.logger = createLogger('AssetLoaderService');
    this.mapLoader = new MapLoader(scene);
    this.errorBoundary = ErrorBoundary.getInstance();
    this.spriteConfig = spriteConfig;
    this.audioConfig = audioConfig;
    
    // Set audio config in loader if provided
    if (audioConfig) {
      audioConfigLoader.setConfig(audioConfig);
    }
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
    
    // Load audio assets
    this.loadAudioAssets();
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
    
    // Load sprite configuration into singleton
    spriteConfigLoader.setConfig(this.spriteConfig);
    
    // Get all animation definitions from the config
    const animationDefinitions = spriteConfigLoader.getAllAnimationDefinitions();
    
    // Register and create animations for each sprite
    Object.entries(animationDefinitions).forEach(([spriteKey, animations]) => {
      // Check if this is a regular sprite animation (has idle and walk) or an emote
      if ('idle' in animations && 'walk' in animations) {
        // Regular sprite with full animation set
        animFactory.registerSpriteAnimations(spriteKey, animations as SpriteAnimationSet);
        animFactory.createSpriteAnimations(spriteKey);
      } else if ('play' in animations) {
        // Emote, projectile, or effect animations - create manually
        const playAnim = animations as { play: AnimationFrameConfig };
        let animKey: string;
        
        if (spriteKey.includes('emote')) {
          animKey = `${spriteKey}_anim`;
        } else if (this.isEffectSprite(spriteKey)) {
          animKey = `${spriteKey}_play`;
        } else {
          animKey = `projectile_${spriteKey}`;
        }
        
        // Check if this is a respawn effect or skill effect (shouldn't loop)
        const isRespawnEffect = (this.spriteConfig.sprites as any).respawnEffects?.[spriteKey];
        const isSkillEffect = (this.spriteConfig.sprites as any).skillEffects?.[spriteKey];
        const shouldLoop = !isRespawnEffect && !isSkillEffect;
        
        this.scene.anims.create({
          key: animKey,
          frames: this.scene.anims.generateFrameNumbers(spriteKey, {
            start: playAnim.play.start,
            end: playAnim.play.end,
          }),
          frameRate: playAnim.play.frameRate,
          repeat: shouldLoop ? -1 : 0, // Only loop projectiles and other continuous effects
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
    this.logger.debug('Loading sprite sheets from config...');
    
    // Use singleton sprite config loader
    spriteConfigLoader.setConfig(this.spriteConfig);
    
    // Load all character and enemy sprites from config
    if (this.spriteConfig.sprites.jobs) {
      spriteConfigLoader.loadSpritesForCategory(this.scene, 'jobs');
    }
    
    if (this.spriteConfig.sprites.enemies) {
      spriteConfigLoader.loadSpritesForCategory(this.scene, 'enemies');
    }
    
    if ((this.spriteConfig.sprites as any).objects) {
      spriteConfigLoader.loadSpritesForCategory(this.scene, 'objects');
    }
    
    if ((this.spriteConfig.sprites as any).projectiles) {
      spriteConfigLoader.loadSpritesForCategory(this.scene, 'projectiles');
    }
    
    if ((this.spriteConfig.sprites as any).effects) {
      spriteConfigLoader.loadSpritesForCategory(this.scene, 'effects');
    }
    
    if ((this.spriteConfig.sprites as any).respawnEffects) {
      spriteConfigLoader.loadSpritesForCategory(this.scene, 'respawnEffects');
    }
    
    if ((this.spriteConfig.sprites as any).icons) {
      spriteConfigLoader.loadSpritesForCategory(this.scene, 'icons');
    }
    
    // Load audio assets
    this.loadAudioAssets();
  }
  
  private loadAudioAssets(): void {
    if (!this.audioConfig) {
      this.logger.debug('No audio configuration provided, skipping audio loading');
      return;
    }

    this.logger.debug('Loading audio assets from configuration...');
    
    // Load each category of audio
    Object.keys(this.audioConfig.audio).forEach(category => {
      if (this.audioConfig?.audio[category]) {
        audioConfigLoader.loadAudioForCategory(this.scene, category);
      }
    });
    
    this.logger.info('Audio assets queued for loading');
  }
  
  
  private isEffectSprite(spriteKey: string): boolean {
    // Check if sprite exists in effects or respawnEffects category
    const effects = (this.spriteConfig.sprites as any).effects;
    const respawnEffects = (this.spriteConfig.sprites as any).respawnEffects;
    return (effects && spriteKey in effects) || (respawnEffects && spriteKey in respawnEffects);
  }
  
  private loadEmotes(): void {
    // Get emotes from sprite config (using singleton)
    spriteConfigLoader.setConfig(this.spriteConfig);
    
    
    // Load emotes based on sprite config structure
    if (this.spriteConfig.sprites.emotes) {
      Object.entries(this.spriteConfig.sprites.emotes).forEach(([emoteName, emoteConfig]) => {
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