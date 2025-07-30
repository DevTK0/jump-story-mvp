import { DbConnection, Job, Teleport, Player } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import Phaser from 'phaser';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { TypedEventEmitter } from './typed-event-emitter';

export interface UICreateConfig {
  connection: DbConnection;
  identity: Identity;
  player: Player;
}

export enum UIEvents {
  DB_CONNECTION_UPDATED = 'ui:db-connection-updated',
  PLAYER_JOB_DATA_UPDATED = 'ui:player-job-data-updated',
  PLAYER_IDENTITY_SET = 'ui:player-identity-set',
  TELEPORT_DATA_UPDATED = 'ui:teleport-data-updated'
}

/**
 * Type-safe event payload definitions for UIContextService events
 */
export interface UIEventPayloads {
  [UIEvents.DB_CONNECTION_UPDATED]: DbConnection;
  [UIEvents.PLAYER_JOB_DATA_UPDATED]: {
    jobData: Map<string, boolean>;
    jobTableData: Job[];
  };
  [UIEvents.TELEPORT_DATA_UPDATED]: {
    teleportData: Map<string, boolean>;
    teleportTableData: Teleport[];
  };
  [UIEvents.PLAYER_IDENTITY_SET]: Identity;
}

/**
 * Centralized service for managing shared UI data and eliminating prop drilling.
 * Provides a single source of truth for database connections, player identity,
 * and job data across all UI components.
 * 
 * Architecture Note: UIContextService uses its own event system instead of scene events
 * because it's a singleton that persists across scene transitions. Scene events are
 * tied to specific scene instances and don't support cross-scene communication.
 */
export class UIContextService {
  private static instance: UIContextService;
  private dbConnection: DbConnection | null = null;
  private playerIdentity: Identity | null = null;
  private jobData: Map<string, boolean> = new Map();
  private jobTableData: Job[] = [];
  private teleportData: Map<string, boolean> = new Map();
  private teleportTableData: Teleport[] = [];
  private eventEmitter: TypedEventEmitter<UIEventPayloads>;
  private logger: ModuleLogger;

  private constructor(_scene: Phaser.Scene) {
    this.eventEmitter = new TypedEventEmitter<UIEventPayloads>();
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
  getJobData(): { jobData: Map<string, boolean>; jobTableData: Job[] } {
    return { 
      jobData: new Map(this.jobData), // Return copy to prevent external modifications
      jobTableData: [...this.jobTableData]
    };
  }

  /**
   * Update job data and emit change event
   */
  updateJobData(jobData: Map<string, boolean>, jobTableData: Job[]): void {
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
   * Get the current teleport data
   */
  getTeleportData(): { teleportData: Map<string, boolean>; teleportTableData: Teleport[] } {
    return { 
      teleportData: new Map(this.teleportData), // Return copy to prevent external modifications
      teleportTableData: [...this.teleportTableData]
    };
  }

  /**
   * Update teleport data and emit change event
   */
  updateTeleportData(teleportData: Map<string, boolean>, teleportTableData: Teleport[]): void {
    this.teleportData = new Map(teleportData);
    this.teleportTableData = [...teleportTableData];
    
    this.logger.debug('Teleport data updated', {
      teleportDataSize: teleportData.size,
      teleportTableLength: teleportTableData.length
    });
    
    this.eventEmitter.emit(UIEvents.TELEPORT_DATA_UPDATED, { 
      teleportData: this.teleportData, 
      teleportTableData: this.teleportTableData 
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
   * @deprecated Use typed event methods when possible
   */
  on(event: string, callback: Function, context?: any): void {
    // Cast to maintain backward compatibility
    this.eventEmitter.on(event as keyof UIEventPayloads, callback as any, context);
  }

  /**
   * Unsubscribe from context events
   * @deprecated Use typed event methods when possible
   */
  off(event: string, callback: Function, context?: any): void {
    // Cast to maintain backward compatibility
    this.eventEmitter.off(event as keyof UIEventPayloads, callback as any, context);
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