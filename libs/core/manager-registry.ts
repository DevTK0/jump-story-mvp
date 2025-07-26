import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from './logger';
import { EnemyManager } from '@/enemy';
import { PeerManager } from '@/peer';
import { PhysicsConfigurator, type CollisionGroups } from '@/physics';
import { InteractionHandler } from '@/networking';
import { EnemyDamageRenderer, PlayerDamageRenderer } from '@/player';
import { LevelUpAnimationManager, ChatManager } from '@/ui';
import { Player } from '@/player';
import { MapLoader } from '@/stage';
import type { MapData } from '@/stage';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { PROXIMITY_CONFIG } from '@/networking/proximity-config';
import { CAMERA_CONFIG } from './camera-config';

export interface ManagerInitConfig {
  mapData: MapData;
  player: Player;
  connection?: DbConnection | null;
  identity?: Identity;
}

/**
 * Registry for all game managers with lifecycle management
 */
export class ManagerRegistry {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  
  // Managers
  private enemyManager!: EnemyManager;
  private peerManager?: PeerManager;
  private physicsConfigurator!: PhysicsConfigurator;
  private interactionHandler!: InteractionHandler;
  private enemyDamageRenderer!: EnemyDamageRenderer;
  private playerDamageRenderer!: PlayerDamageRenderer;
  private levelUpAnimationManager!: LevelUpAnimationManager;
  private chatManager!: ChatManager;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.logger = createLogger('ManagerRegistry');
  }
  
  /**
   * Initialize all managers
   */
  async initialize(config: ManagerInitConfig): Promise<void> {
    this.logger.info('Initializing managers...');
    
    // Create core managers
    this.createCoreManagers(config);
    
    // Create rendering managers
    this.createRenderingManagers(config);
    
    // Create UI managers
    this.createUIManagers();
    
    // Setup connections if available
    if (config.connection) {
      this.setupDatabaseConnections(config.connection, config.identity);
    }
    
    // Setup manager relationships
    this.setupManagerRelationships();
    
    this.logger.info('All managers initialized');
  }
  
  /**
   * Setup physics for all systems
   */
  async setupPhysics(player: Player, mapData: MapData): Promise<void> {
    this.logger.debug('Setting up physics...');
    
    // Create collision groups from map data
    const mapLoader = new MapLoader(this.scene);
    const collisionGroups: CollisionGroups = {
      ground: mapLoader.createPhysicsFromGround(mapData.ground),
      platforms: mapLoader.createPhysicsFromPlatforms(mapData.platforms),
      climbeable: mapLoader.createClimbeablePhysics(mapData.climbeable),
      boundaries: mapLoader.createBoundaryPhysics(mapData.boundaries),
    };
    
    // Get player systems
    const climbingSystem = player.getSystem('climbing');
    const combatSystem = player.getSystem('combat');
    
    // Create interaction callbacks
    const interactionCallbacks = this.interactionHandler.createInteractionCallbacks(
      player,
      this.enemyManager
    );
    
    // Setup all collisions
    this.physicsConfigurator.setupAllCollisions(
      player,
      this.enemyManager,
      collisionGroups,
      combatSystem,
      climbingSystem,
      interactionCallbacks,
      this.scene
    );
  }
  
  /**
   * Update all managers
   */
  update(_time: number, _delta: number): void {
    // Update peer manager for smooth interpolation
    if (this.peerManager) {
      this.peerManager.update();
    }
    
    // Enemy manager is server-driven, no update needed
  }
  
  /**
   * Cleanup all managers
   */
  destroy(): void {
    this.logger.info('Destroying managers...');
    
    // Cleanup in reverse order of creation
    this.chatManager?.destroy();
    this.levelUpAnimationManager?.destroy();
    this.playerDamageRenderer?.destroy();
    this.enemyDamageRenderer?.destroy();
    this.peerManager?.destroy();
    this.enemyManager?.destroy();
  }
  
  // Manager creation methods
  
  private createCoreManagers(config: ManagerInitConfig): void {
    // Enemy manager with proximity subscriptions
    this.enemyManager = new EnemyManager(this.scene, {
      useProximitySubscription: true,
      proximityRadius: PROXIMITY_CONFIG.enemy.defaultRadius,
    });
    
    // Physics configurator
    this.physicsConfigurator = new PhysicsConfigurator(this.scene);
    
    // Interaction handler
    this.interactionHandler = new InteractionHandler(this.scene, config.connection || null, {
      cameraShakeDuration: CAMERA_CONFIG.shake.defaultDuration,
      cameraShakeIntensity: CAMERA_CONFIG.shake.defaultIntensity,
    });
  }
  
  private createRenderingManagers(config: ManagerInitConfig): void {
    // Enemy damage renderer
    this.enemyDamageRenderer = new EnemyDamageRenderer(this.scene);
    this.enemyDamageRenderer.setEnemyManager(this.enemyManager);
    
    // Player damage renderer
    this.playerDamageRenderer = new PlayerDamageRenderer(this.scene);
    this.playerDamageRenderer.setPlayer(config.player);
  }
  
  private createUIManagers(): void {
    // Level up animation manager
    this.levelUpAnimationManager = new LevelUpAnimationManager(this.scene);
    
    // Chat manager
    this.chatManager = new ChatManager(this.scene);
  }
  
  private setupDatabaseConnections(connection: DbConnection, identity?: Identity): void {
    // Set connections on managers that need them
    this.enemyManager.setDbConnection(connection);
    this.interactionHandler.setDbConnection(connection);
    this.chatManager.setDbConnection(connection);
    this.playerDamageRenderer.setDbConnection(connection);
    
    // Initialize peer manager if we have identity
    if (identity) {
      this.peerManager = new PeerManager(this.scene, {
        useProximitySubscription: true,
        proximityRadius: PROXIMITY_CONFIG.peer.defaultRadius,
        proximityUpdateInterval: PROXIMITY_CONFIG.peer.defaultUpdateInterval,
      });
      this.peerManager.setLocalPlayerIdentity(identity);
      this.peerManager.setDbConnection(connection);
      
      // Initialize level up manager with identity
      this.levelUpAnimationManager.initialize(connection, identity);
    }
    
    // Setup damage event subscriptions
    this.setupDamageEventSubscription(connection);
  }
  
  private setupManagerRelationships(): void {
    // Connect enemy manager to interaction handler
    this.interactionHandler.setEnemyManager(this.enemyManager);
    
    // Connect peer manager with other UI managers
    if (this.peerManager) {
      this.peerManager.setLevelUpAnimationManager(this.levelUpAnimationManager);
      this.peerManager.setChatManager(this.chatManager);
    }
  }
  
  private setupDamageEventSubscription(connection: DbConnection): void {
    // Subscribe to enemy damage events
    connection.db.enemyDamageEvent.onInsert((_ctx, damageEvent) => {
      // Handle damage numbers
      this.enemyDamageRenderer.handleDamageEvent(damageEvent);
      
      // Handle hit animation
      this.enemyManager.playHitAnimation(damageEvent.enemyId);
    });
  }
  
  // Getters for external access
  
  getEnemyManager(): EnemyManager {
    return this.enemyManager;
  }
  
  getPeerManager(): PeerManager | undefined {
    return this.peerManager;
  }
  
  getLevelUpAnimationManager(): LevelUpAnimationManager {
    return this.levelUpAnimationManager;
  }
  
  getChatManager(): ChatManager {
    return this.chatManager;
  }
  
  getEnemyDamageRenderer(): EnemyDamageRenderer {
    return this.enemyDamageRenderer;
  }
}