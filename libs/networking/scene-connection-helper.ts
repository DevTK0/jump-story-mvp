import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { SpacetimeConnectionBuilder } from './spacetime-connection-builder';
import { SpacetimeConnector } from './spacetime-connector';
import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { Player, PlayerQueryService, CombatValidationService, DeathMonitor } from '@/player';
import { ErrorBoundary, NetworkError } from '@/core/error';

export interface ConnectionConfig {
  target: 'local' | 'cloud';
  moduleName: string;
}

/**
 * Helper class to manage database connections for scenes
 */
export class SceneConnectionHelper {
  private scene: Phaser.Scene;
  private logger: ModuleLogger;
  private connectionManager?: SpacetimeConnector;
  private errorBoundary: ErrorBoundary;
  private config: ConnectionConfig;

  private connection?: DbConnection;
  private identity?: Identity;

  constructor(scene: Phaser.Scene, config: ConnectionConfig) {
    this.scene = scene;
    this.config = config;
    this.logger = createLogger('SceneConnectionHelper');
    this.errorBoundary = ErrorBoundary.getInstance();
  }

  /**
   * Set an existing connection (e.g., from preloader)
   */
  async setExistingConnection(connection: DbConnection, identity: Identity): Promise<void> {
    this.connection = connection;
    this.identity = identity;
    
    this.logger.info('Using existing database connection');
    
    // Initialize singleton services with the connection
    this.initializeSingletonServices(connection, identity);
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    const dbUri =
      this.config.target === 'cloud' ? 'wss://maincloud.spacetimedb.com' : 'ws://localhost:3000';

    this.logger.info(`Connecting to SpaceTimeDB (${this.config.target}): ${dbUri}`);

    // Build connection with core table subscriptions
    this.connectionManager = new SpacetimeConnectionBuilder()
      .setUri(dbUri)
      .setModuleName(this.config.moduleName)
      .subscribeToCoreTables() // Subscribe to Player, Job, PlayerJob, JobAttack
      .onConnect(this.handleDatabaseConnect.bind(this))
      .onDisconnect(() => this.logger.info('Disconnected from SpacetimeDB'))
      .onError((_ctx, err) => {
        this.logger.error('Error connecting to SpacetimeDB:', err);
        this.errorBoundary.handleError(
          new NetworkError('Database connection error', {
            scene: this.scene,
            system: 'database',
            action: 'connection',
          })
        );
      })
      .onSubscriptionApplied((_ctx) => this.logger.info('Core tables subscription applied!'))
      .build();

    // Start connection
    try {
      await this.connectionManager.connect();
    } catch (err: any) {
      this.logger.error('Failed to connect to database:', err);
      this.errorBoundary.handleError(
        new NetworkError('Failed to connect to database', {
          scene: this.scene,
          system: 'database',
          action: 'connect',
        })
      );
      throw err;
    }
  }

  /**
   * Disconnect from the database
   */
  disconnect(): void {
    if (this.connectionManager) {
      this.connectionManager.disconnect();
    }
  }

  /**
   * Get the current connection
   */
  getConnection(): DbConnection | null {
    return this.connection || null;
  }

  /**
   * Get the current identity
   */
  getIdentity(): Identity | null {
    return this.identity || null;
  }

  /**
   * Setup player systems with database connection
   */
  setupPlayerSystems(player: Player, connection: DbConnection): void {
    const syncSystem = player.getSystem('sync') as any;
    if (syncSystem && syncSystem.setDbConnection) {
      syncSystem.setDbConnection(connection);
    }

    const combatSystem = player.getSystem('combat') as any;
    if (combatSystem) {
      if (combatSystem.setSyncManager && syncSystem) {
        // Get the sync manager from sync system
        const syncManager = syncSystem.getSyncManager();
        combatSystem.setSyncManager(syncManager);
      }
      if (combatSystem.setDbConnection) {
        combatSystem.setDbConnection(connection);
      }
    }

    const respawnSystem = player.getSystem('respawn') as any;
    if (respawnSystem && respawnSystem.setDbConnection) {
      respawnSystem.setDbConnection(connection);
    }

    const deathMonitor = player.getSystem<DeathMonitor>('deathMonitor');
    if (deathMonitor && deathMonitor.setDbConnection) {
      deathMonitor.setDbConnection(connection);
    }

    const teleportSystem = player.getSystem('teleport') as any;
    if (teleportSystem && teleportSystem.setDbConnection) {
      teleportSystem.setDbConnection(connection);
    }
  }

  private initializeSingletonServices(conn: DbConnection, identity: Identity): void {
    // Initialize the PlayerQueryService singleton immediately
    PlayerQueryService.getInstance(conn);
    this.logger.info('PlayerQueryService singleton initialized');

    // Initialize the CombatValidationService singleton
    CombatValidationService.getInstance(conn);
    this.logger.info('CombatValidationService singleton initialized');

    // Emit event for other systems to react
    this.scene.events.emit('database-connected', { connection: conn, identity });
  }

  private handleDatabaseConnect(conn: DbConnection, identity: Identity, _token: string): void {
    this.connection = conn;
    this.identity = identity;

    // Initialize singleton services
    this.initializeSingletonServices(conn, identity);
  }
}
