import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '../logger';
import { EnemyManager, BossManager } from '@/enemy';
import { PeerManager } from '@/peer';
import { PhysicsSetupCoordinator } from '@/core/physics/physics-setup-coordinator';
import { MapPhysicsFactory } from '@/core/physics/map-physics-factory';
import { InteractionHandler } from '@/networking';
import { EnemyDamageRenderer, PlayerDamageRenderer, SkillEffectRenderer, RespawnEffectRenderer } from '@/player';
import { LevelUpAnimationManager, ChatManager } from '@/ui';
import { SkillAudioService } from '@/player/services/skill-audio-service';
import { MusicManagerService } from '@/player/services/music-manager-service';
import { PlayerEventAudioService } from '@/player/services/player-event-audio-service';
import { EnemyAudioService } from '@/enemy/services/enemy-audio-service';
import { TeleportStoneManager } from '@/teleport/teleport-stone-manager';
import type { MapData } from '../asset/map-loader';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { PROXIMITY_CONFIG } from '@/networking/proximity-config';
import { CAMERA_CONFIG } from '../camera-config';
import type { Player } from '@/player';

export interface ManagerInitConfig {
  mapData: MapData;
  player: Player;
  connection: DbConnection;
  identity: Identity;
}

/**
 * Registry for all game managers with lifecycle management
 */
export class ManagerRegistry {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  
  // Managers
  private enemyManager!: EnemyManager;
  private bossManager!: BossManager;
  private peerManager?: PeerManager;
  private physicsManager!: PhysicsSetupCoordinator;
  private interactionManager!: InteractionHandler;
  private enemyDamageManager!: EnemyDamageRenderer;
  private playerDamageManager!: PlayerDamageRenderer;
  private skillEffectManager!: SkillEffectRenderer;
  private respawnEffectManager!: RespawnEffectRenderer;
  private levelUpAnimationManager!: LevelUpAnimationManager;
  private chatManager!: ChatManager;
  private teleportStoneManager!: TeleportStoneManager;
  private skillAudioService!: SkillAudioService;
  private musicManagerService!: MusicManagerService;
  private playerEventAudioService!: PlayerEventAudioService;
  private enemyAudioService!: EnemyAudioService;
  
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
    
    // Setup database connections
    this.setupDatabaseConnections(config.connection, config.identity);
    
    // Setup manager relationships
    this.setupManagerRelationships();
    
    this.logger.info('All managers initialized');
  }
  
  /**
   * Setup physics for all systems
   */
  async setupPhysics(player: Player, mapData: MapData): Promise<void> {
    this.logger.debug('Setting up physics...');
    
    // Create collision groups from map data using MapPhysicsFactory
    const collisionGroups = MapPhysicsFactory.createAllCollisionGroups(this.scene, mapData);
    
    // Register collision groups with the coordinator
    this.physicsManager.registerCollisionGroups(collisionGroups);
    
    // Register entities that implement PhysicsEntity
    this.physicsManager.registerEntity(player);
    this.physicsManager.registerEntity(this.enemyManager);
    this.physicsManager.registerEntity(this.bossManager);
    
    // Set up physics for all registered entities
    this.physicsManager.setupAllPhysics();
    
    // Get combat system and register hitboxes if enhanced combat is used
    const combatSystem = player.getSystem('combat');
    if (combatSystem && 'registerHitboxPhysics' in combatSystem) {
      const registry = this.physicsManager.getRegistry();
      const interactionCallbacks = this.interactionManager.createInteractionCallbacks(
        player,
        this.enemyManager
      );
      
      (combatSystem as any).registerHitboxPhysics(
        registry,
        interactionCallbacks.onAttackHitEnemy,
        this.scene
      );
    }
    
    // Set up player-enemy interaction overlaps
    const registry = this.physicsManager.getRegistry();
    const interactionCallbacks = this.interactionManager.createInteractionCallbacks(
      player,
      this.enemyManager
    );
    
    registry.addOverlap(
      player,
      'enemies',
      interactionCallbacks.onPlayerTouchEnemy as any,
      undefined,
      this.scene
    );
    
    // Set up player-boss interaction overlaps for touch damage
    registry.addOverlap(
      player,
      'bosses',
      interactionCallbacks.onPlayerTouchEnemy as any,
      undefined,
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
    
    // Update enemy damage renderer for projectile animations
    if (this.enemyDamageManager) {
      this.enemyDamageManager.update();
    }
    
    // Enemy manager is server-driven, no update needed
  }
  
  /**
   * Cleanup all managers
   */
  destroy(): void {
    this.logger.info('Destroying managers...');
    
    // Remove registry event listeners
    this.scene.registry.events.off('enemy:spawned');
    this.scene.registry.events.off('enemy:despawned');
    this.scene.registry.events.off('enemy:died');
    this.scene.registry.events.off('boss:attack');
    
    // Cleanup in reverse order of creation
    this.enemyAudioService?.destroy();
    this.playerEventAudioService?.destroy();
    this.musicManagerService?.destroy();
    this.skillAudioService?.destroy();
    this.chatManager?.destroy();
    this.levelUpAnimationManager?.destroy();
    this.skillEffectManager?.destroy();
    this.respawnEffectManager?.destroy();
    this.playerDamageManager?.destroy();
    this.enemyDamageManager?.destroy();
    this.teleportStoneManager?.destroy();
    this.peerManager?.destroy();
    this.enemyManager?.destroy();
    this.bossManager?.destroy();
  }
  
  // Manager creation methods
  
  private createCoreManagers(config: ManagerInitConfig): void {
    // Enemy manager with proximity subscriptions
    this.enemyManager = new EnemyManager(this.scene, {
      useProximitySubscription: true,
      proximityRadius: PROXIMITY_CONFIG.enemy.defaultRadius,
    });
    
    // Boss manager with proximity subscriptions
    this.bossManager = new BossManager(this.scene, {
      useProximitySubscription: true,
      proximityRadius: PROXIMITY_CONFIG.boss.defaultRadius,
      proximityUpdateInterval: PROXIMITY_CONFIG.boss.defaultUpdateInterval,
    });
    
    // Physics coordinator
    this.physicsManager = new PhysicsSetupCoordinator(this.scene);
    
    // Interaction handler
    this.interactionManager = new InteractionHandler(this.scene, config.connection || null, {
      cameraShakeDuration: CAMERA_CONFIG.shake.defaultDuration,
      cameraShakeIntensity: CAMERA_CONFIG.shake.defaultIntensity,
    });
    
    // Teleport stone manager
    this.teleportStoneManager = new TeleportStoneManager(this.scene);
  }
  
  private createRenderingManagers(config: ManagerInitConfig): void {
    // Enemy damage renderer
    this.enemyDamageManager = new EnemyDamageRenderer(this.scene);
    this.enemyDamageManager.setEnemyManager(this.enemyManager);
    this.enemyDamageManager.setBossManager(this.bossManager);
    this.enemyDamageManager.setPlayerSprite(config.player);
    
    // Player damage renderer
    this.playerDamageManager = new PlayerDamageRenderer(this.scene);
    this.playerDamageManager.setPlayer(config.player);
    
    // Skill effect renderer
    this.skillEffectManager = new SkillEffectRenderer(this.scene);
    
    // Respawn effect renderer
    this.respawnEffectManager = new RespawnEffectRenderer(this.scene, config.player);
  }
  
  private createUIManagers(): void {
    // Level up animation manager
    this.levelUpAnimationManager = new LevelUpAnimationManager(this.scene);
    
    // Chat manager
    this.chatManager = new ChatManager(this.scene);
    
    // Skill audio service
    this.skillAudioService = new SkillAudioService(this.scene);
    
    // Music manager service
    this.musicManagerService = new MusicManagerService(this.scene);
    
    // Player event audio service
    this.playerEventAudioService = new PlayerEventAudioService(this.scene);
    
    // Enemy audio service
    this.enemyAudioService = new EnemyAudioService(this.scene);
  }
  
  private setupDatabaseConnections(connection: DbConnection, identity: Identity): void {
    // Set connections on managers that need them
    this.enemyManager.setDbConnection(connection);
    this.bossManager.setDbConnection(connection);
    this.bossManager.setLocalPlayerIdentity(identity);
    this.interactionManager.setDbConnection(connection);
    this.chatManager.setDbConnection(connection);
    this.playerDamageManager.setDbConnection(connection);
    this.teleportStoneManager.setDbConnection(connection);
    
    // Initialize peer manager with identity
    this.peerManager = new PeerManager(this.scene, {
      useProximitySubscription: true,
      proximityRadius: PROXIMITY_CONFIG.peer.defaultRadius,
      proximityUpdateInterval: PROXIMITY_CONFIG.peer.defaultUpdateInterval,
    });
    this.peerManager.setLocalPlayerIdentity(identity);
    this.peerManager.setDbConnection(connection);
    
    // Set peer manager on player damage renderer for skill effects
    this.playerDamageManager.setPeerManager(this.peerManager);
    
    // Initialize level up manager with identity
    this.levelUpAnimationManager.initialize(connection, identity);
    
    // Pass identity to enemy damage manager for projectile rendering
    this.enemyDamageManager.setLocalPlayerIdentity(identity.toHexString());
    
    // Initialize music manager service with connection
    this.musicManagerService.initialize(connection);
    
    // Setup damage event subscriptions
    this.setupDamageEventSubscription(connection);
  }
  
  private setupManagerRelationships(): void {
    // Connect enemy manager to interaction handler
    this.interactionManager.setEnemyManager(this.enemyManager);
    
    // Connect boss manager to interaction handler
    this.interactionManager.setBossManager(this.bossManager);
    
    // Connect peer manager with other UI managers
    if (this.peerManager) {
      this.peerManager.setLevelUpAnimationManager(this.levelUpAnimationManager);
      this.peerManager.setChatManager(this.chatManager);
      
      // Connect peer manager to enemy damage renderer for projectile rendering
      this.enemyDamageManager.setPeerManager(this.peerManager);
      
      // Initialize skill effect renderer with managers
      this.skillEffectManager.initialize(this.peerManager, this.enemyManager);
    }
    
    // Connect enemy audio service with managers
    this.enemyAudioService.setEnemyManager(this.enemyManager);
    this.enemyAudioService.setBossManager(this.bossManager);
    
    // Listen for enemy spawn events to register with audio service
    this.scene.registry.events.on('enemy:spawned', (spawnId: number, enemyType: string) => {
      this.enemyAudioService.registerEnemySpawn(spawnId, enemyType);
    });
    
    // Listen for enemy despawn events
    this.scene.registry.events.on('enemy:despawned', (spawnId: number) => {
      this.enemyAudioService.unregisterEnemy(spawnId);
    });
    
    // Listen for enemy death events
    this.scene.registry.events.on('enemy:died', (spawnId: number) => {
      this.enemyAudioService.playEnemyDeathSound(spawnId);
    });
    
    // Listen for boss attack events
    this.scene.registry.events.on('boss:attack', (spawnId: number, attackNumber: 1 | 2 | 3) => {
      this.enemyAudioService.playBossAttackSound(spawnId, attackNumber);
    });
  }
  
  private setupDamageEventSubscription(connection: DbConnection): void {
    // Subscribe to enemy damage events
    connection.db.enemyDamageEvent.onInsert((_ctx, damageEvent) => {
      // Handle damage numbers
      this.enemyDamageManager.handleDamageEvent(damageEvent);
      
      // Handle skill effects
      this.skillEffectManager.handleDamageEvent(damageEvent);
      
      // Handle hit animation for regular enemies
      this.enemyManager.playHitAnimation(damageEvent.spawnId);
      
      // Mark enemy as attacked to show name
      this.enemyManager.markEnemyAsAttacked(damageEvent.spawnId);
      
      // Handle hit animation for bosses
      this.bossManager.playHitAnimation(damageEvent.spawnId);
      
      // Handle damage sound
      this.enemyAudioService.playEnemyDamageSound(damageEvent.spawnId);
    });
  }
  
  // Getters for external access
  
  getEnemyManager(): EnemyManager {
    return this.enemyManager;
  }
  
  getBossManager(): BossManager {
    return this.bossManager;
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
  
  getEnemyDamageManager(): EnemyDamageRenderer {
    return this.enemyDamageManager;
  }
  
  getPlayerDamageManager(): PlayerDamageRenderer {
    return this.playerDamageManager;
  }
  
  getSkillEffectManager(): SkillEffectRenderer {
    return this.skillEffectManager;
  }
  
  getRespawnEffectManager(): RespawnEffectRenderer {
    return this.respawnEffectManager;
  }
  
  getPhysicsManager(): PhysicsSetupCoordinator {
    return this.physicsManager;
  }
  
  getInteractionManager(): InteractionHandler {
    return this.interactionManager;
  }
  
  getTeleportStoneManager(): TeleportStoneManager {
    return this.teleportStoneManager;
  }
  
  getPlayerEventAudioService(): PlayerEventAudioService {
    return this.playerEventAudioService;
  }
}