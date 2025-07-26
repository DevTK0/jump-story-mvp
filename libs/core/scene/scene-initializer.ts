import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '../logger';
import { AssetLoaderService } from '../asset/asset-loader-service';
import { ManagerRegistry } from './manager-registry';
import { UIFactory } from '@/ui/ui-factory';
import { SceneConnectionHelper } from '@/networking/scene-connection-helper';
import { DebugSceneExtension } from '@/debug/debug-scene-extension';
import { Player } from '@/player';
import type { MapData } from '../asset/map-loader';
import type { SpriteConfig } from '../asset/sprite-config-loader';

export interface SceneConfig {
  key: string;
  player?: {
    spawnX: number;
    spawnY: number;
    texture: string;
  };
  database?: {
    target?: 'local' | 'cloud';
    moduleName?: string;
  };
  debug?: {
    enabled: boolean;
    shadow?: boolean;  // Enable shadow effect in debug mode
    invulnerable?: boolean;  // Prevent player from taking damage (useful for testing)
  };
  sprites?: SpriteConfig;  // Optional sprite configuration
}

export interface InitializedSystems {
  player: Player;
  mapData: MapData;
  managers: ManagerRegistry;
  ui: UIFactory;
  connection: SceneConnectionHelper;
  debug?: DebugSceneExtension;
}

/**
 * Orchestrates scene initialization with clear stages
 */
export class SceneInitializer {
  private scene: Phaser.Scene;
  private config: SceneConfig;
  private logger: ModuleLogger;
  
  private assetLoader: AssetLoaderService;
  private managers!: ManagerRegistry;
  private uiFactory!: UIFactory;
  private connectionHelper!: SceneConnectionHelper;
  private debugExtension?: DebugSceneExtension;
  
  private systems: Partial<InitializedSystems> = {};
  
  constructor(scene: Phaser.Scene, config: SceneConfig) {
    this.scene = scene;
    this.config = config;
    this.logger = createLogger('SceneInitializer');
    
    // Initialize core services with sprite config if provided
    if (!config.sprites) {
      throw new Error('Sprite configuration is required in SceneConfig');
    }
    this.assetLoader = new AssetLoaderService(scene, config.sprites);
  }
  
  /**
   * Load all required assets
   */
  loadAssets(): void {
    this.logger.info('Loading assets...');
    this.assetLoader.loadSceneAssets();
  }
  
  /**
   * Start the initialization pipeline
   */
  async start(): Promise<void> {
    this.logger.info('Starting scene initialization...');
    
    try {
      // Store scene config in scene data for access by systems
      this.scene.data.set('sceneConfig', this.config);
      
      // Stage 0: Set debug and shadow states based on config (before player creation)
      if (this.config.debug) {
        const { DebugState, ShadowState } = await import('@/debug/debug-state');
        
        // Set debug state if enabled
        if (this.config.debug.enabled) {
          DebugState.getInstance().enabled = true;
        }
        
        // Set shadow state independently of debug mode
        ShadowState.getInstance().enabled = this.config.debug.shadow ?? false;
      }
      
      // Stage 1: Create animations from loaded assets
      await this.initializeAnimations();
      
      // Stage 2: Setup map
      await this.initializeMap();
      
      // Stage 3: Initialize database connection
      await this.initializeDatabase();
      
      // Stage 4: Create player
      await this.initializePlayer();
      
      // Stage 5: Initialize managers
      await this.initializeManagers();
      
      // Stage 6: Setup UI
      await this.initializeUI();
      
      // Stage 7: Configure physics
      await this.initializePhysics();
      
      // Stage 8: Optional debug features
      if (this.config.debug?.enabled) {
        await this.initializeDebug();
      }
      
      this.logger.info('Scene initialization complete');
    } catch (error) {
      this.logger.error('Scene initialization failed', { error });
      throw error;
    }
  }
  
  /**
   * Update loop delegation
   */
  update(time: number, delta: number): void {
    // Update player
    if (this.systems.player) {
      this.systems.player.update(time, delta);
    }
    
    // Update UI
    if (this.uiFactory) {
      this.uiFactory.update(time, delta);
    }
    
    // Update managers
    if (this.managers) {
      this.managers.update(time, delta);
    }
  }
  
  /**
   * Cleanup on scene shutdown
   */
  shutdown(): void {
    this.logger.info('Shutting down scene...');
    
    // Cleanup in reverse order
    this.debugExtension?.destroy();
    this.uiFactory?.destroy();
    this.managers?.destroy();
    this.connectionHelper?.disconnect();
  }
  
  // Private initialization stages
  
  private async initializeAnimations(): Promise<void> {
    this.logger.debug('Initializing animations...');
    this.assetLoader.createAllAnimations();
  }
  
  private async initializeMap(): Promise<void> {
    this.logger.debug('Initializing map...');
    
    // Setup background color
    const { DISPLAY_CONFIG } = await import('../display-config');
    this.scene.cameras.main.setBackgroundColor(DISPLAY_CONFIG.backgroundColor);
    
    const mapData = this.assetLoader.createMap();
    this.systems.mapData = mapData;
    
    // Setup world bounds
    const mapWidth = mapData.tilemap.widthInPixels;
    const mapHeight = mapData.tilemap.heightInPixels;
    this.scene.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    
    // Setup camera bounds
    this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
  }
  
  private async initializeDatabase(): Promise<void> {
    this.logger.debug('Initializing database connection...');
    
    this.connectionHelper = new SceneConnectionHelper(this.scene, {
      target: this.config.database?.target || 'local',
      moduleName: this.config.database?.moduleName || 'jump-story',
    });
    
    this.systems.connection = this.connectionHelper;
    
    // Start connection
    await this.connectionHelper.connect();
  }
  
  private async initializePlayer(): Promise<void> {
    this.logger.debug('Initializing player...');
    
    if (!this.config.player) {
      throw new Error('Player configuration missing');
    }
    
    // Import PlayerBuilder dynamically to avoid circular deps
    const { PlayerBuilder } = await import('@/player');
    
    const player = new PlayerBuilder(this.scene)
      .setPosition(this.config.player.spawnX, this.config.player.spawnY)
      .setTexture(this.config.player.texture)
      .withAllSystems()
      .build();
    
    this.systems.player = player;
    
    // Import and apply player config
    const { PLAYER_CONFIG } = await import('@/player/config');
    player.setScale(PLAYER_CONFIG.movement.scale);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(
      PLAYER_CONFIG.movement.hitboxWidth,
      PLAYER_CONFIG.movement.hitboxHeight
    );
    
    // Set player depth to render above all other entities
    player.setDepth(10);
    
    // Setup camera to follow player
    this.scene.cameras.main.startFollow(player);
    
    // Connect player to database if available
    const connection = this.connectionHelper.getConnection();
    if (connection) {
      this.connectionHelper.setupPlayerSystems(player, connection);
    }
  }
  
  private async initializeManagers(): Promise<void> {
    this.logger.debug('Initializing managers...');
    
    this.managers = new ManagerRegistry(this.scene);
    this.systems.managers = this.managers;
    
    // Initialize all managers
    const connection = this.connectionHelper.getConnection();
    const identity = this.connectionHelper.getIdentity();
    
    if (!connection || !identity) {
      throw new Error('Database connection and identity are required for manager initialization');
    }
    
    await this.managers.initialize({
      mapData: this.systems.mapData!,
      player: this.systems.player!,
      connection,
      identity,
    });
    
    // Store managers in scene data for access by other systems
    this.scene.data.set('managers', this.managers);
    
    // Store player reference for ChatManager and other systems
    this.scene.data.set('player', this.systems.player);
  }
  
  private async initializeUI(): Promise<void> {
    this.logger.debug('Initializing UI...');
    
    this.uiFactory = new UIFactory(this.scene);
    this.systems.ui = this.uiFactory;
    
    // Create UI components
    const connection = this.connectionHelper.getConnection();
    const identity = this.connectionHelper.getIdentity();
    
    if (connection && identity) {
      this.uiFactory.createGameUI({
        connection,
        identity,
        player: this.systems.player!,
      });
    }
  }
  
  private async initializePhysics(): Promise<void> {
    this.logger.debug('Initializing physics...');
    
    if (!this.systems.mapData || !this.systems.player || !this.managers) {
      throw new Error('Required systems not initialized before physics');
    }
    
    // Physics configuration will be handled by managers
    await this.managers.setupPhysics(
      this.systems.player,
      this.systems.mapData
    );
  }
  
  private async initializeDebug(): Promise<void> {
    this.logger.debug('Initializing debug features...');
    
    this.debugExtension = new DebugSceneExtension(this.scene);
    this.systems.debug = this.debugExtension;
    
    // Register debuggable systems
    if (this.systems.player) {
      // Player implements IDebuggable through its debug system
      this.debugExtension.registerDebuggable('player', this.systems.player as any);
    }
    
    // Register enemy manager for debug rendering
    if (this.systems.managers) {
      const enemyManager = this.systems.managers.getEnemyManager();
      if (enemyManager) {
        this.debugExtension.registerDebuggable('enemyManager', enemyManager as any);
      }
    }
    
    // If the scene itself implements IDebuggable, register it
    const scene = this.scene as any;
    if (scene.isDebugEnabled && scene.renderDebug && scene.getDebugInfo) {
      this.debugExtension.registerDebuggable('scene', scene);
    }
    
    this.debugExtension.enable();
  }
  
  /**
   * Get initialized systems for external access
   */
  getSystems(): InitializedSystems {
    if (!this.systems.player || !this.systems.mapData || !this.systems.managers || 
        !this.systems.ui || !this.systems.connection) {
      throw new Error('Not all systems are initialized');
    }
    
    return this.systems as InitializedSystems;
  }
}