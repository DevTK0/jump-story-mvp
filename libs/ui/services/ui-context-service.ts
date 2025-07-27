import { DbConnection } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';

export interface UICreateConfig {
  connection: DbConnection;
  identity: Identity;
  player: any; // Type from @/player
}

export enum UIEvents {
  DB_CONNECTION_UPDATED = 'ui:db-connection-updated',
  PLAYER_JOB_DATA_UPDATED = 'ui:player-job-data-updated',
  PLAYER_IDENTITY_SET = 'ui:player-identity-set'
}

/**
 * Centralized service for managing shared UI data and eliminating prop drilling.
 * Provides a single source of truth for database connections, player identity,
 * and job data across all UI components.
 */
export class UIContextService {
  private static instance: UIContextService;
  private scene: Phaser.Scene;
  private dbConnection: DbConnection | null = null;
  private playerIdentity: Identity | null = null;
  private jobData: Map<string, boolean> = new Map();
  private jobTableData: any[] = [];
  private eventEmitter: Phaser.Events.EventEmitter;
  private logger: ModuleLogger;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.eventEmitter = new Phaser.Events.EventEmitter();
    this.logger = createLogger('UIContextService');
  }

  /**
   * Initialize the UIContextService singleton with initial configuration
   */
  static initialize(scene: Phaser.Scene, config: UICreateConfig): UIContextService {
    if (!this.instance) {
      this.instance = new UIContextService(scene);
      this.instance.setInitialConfig(config);
      this.instance.logger.info('UIContextService initialized');
    }
    return this.instance;
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): UIContextService {
    if (!this.instance) {
      throw new Error('UIContextService not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  /**
   * Set initial configuration from UIFactory
   */
  private setInitialConfig(config: UICreateConfig): void {
    this.dbConnection = config.connection;
    this.playerIdentity = config.identity;
    this.logger.debug('Initial config set', {
      hasConnection: !!config.connection,
      identityHex: config.identity.toHexString()
    });
  }

  /**
   * Get the database connection
   */
  getDbConnection(): DbConnection | null {
    return this.dbConnection;
  }

  /**
   * Get the player identity
   */
  getPlayerIdentity(): Identity | null {
    return this.playerIdentity;
  }

  /**
   * Get the current job data
   */
  getJobData(): { jobData: Map<string, boolean>; jobTableData: any[] } {
    return { 
      jobData: new Map(this.jobData), // Return copy to prevent external modifications
      jobTableData: [...this.jobTableData]
    };
  }

  /**
   * Update job data and emit change event
   */
  updateJobData(jobData: Map<string, boolean>, jobTableData: any[]): void {
    this.jobData = new Map(jobData);
    this.jobTableData = [...jobTableData];
    
    this.logger.debug('Job data updated', {
      jobDataSize: jobData.size,
      jobTableLength: jobTableData.length
    });
    
    this.eventEmitter.emit(UIEvents.PLAYER_JOB_DATA_UPDATED, { 
      jobData: this.jobData, 
      jobTableData: this.jobTableData 
    });
  }

  /**
   * Update database connection (if needed for reconnection scenarios)
   */
  updateDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    this.logger.info('Database connection updated');
    this.eventEmitter.emit(UIEvents.DB_CONNECTION_UPDATED, connection);
  }

  /**
   * Subscribe to context events
   */
  on(event: string, callback: Function, context?: any): void {
    this.eventEmitter.on(event, callback, context);
  }

  /**
   * Unsubscribe from context events
   */
  off(event: string, callback: Function, context?: any): void {
    this.eventEmitter.off(event, callback, context);
  }

  /**
   * Clean up the service
   */
  destroy(): void {
    this.logger.info('Destroying UIContextService');
    this.eventEmitter.destroy();
    UIContextService.instance = null as any;
  }

  /**
   * Check if the service has been initialized
   */
  static isInitialized(): boolean {
    return !!this.instance;
  }
}