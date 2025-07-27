import { DbConnection, type ErrorContext, type SubscriptionEventContext } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

// Connection-specific error types
export class ConnectionError extends Error {
  public readonly code = 'CONNECTION_ERROR';

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class TimeoutError extends Error {
  public readonly code = 'TIMEOUT_ERROR';

  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export interface SpacetimeConnectionConfig {
  uri: string;
  moduleName: string;
}

export interface SubscriptionConfig {
  /** Tables to subscribe to. If empty, no automatic subscriptions are made */
  tables?: string[];
  /** Custom SQL queries for subscriptions */
  queries?: string[];
  /** Whether to skip automatic subscriptions entirely */
  skipAutoSubscribe?: boolean;
}

export interface SpacetimeConnectionCallbacks {
  onConnect?: (connection: DbConnection, identity: Identity, token: string) => void;
  onDisconnect?: () => void;
  onError?: (ctx: ErrorContext, error: Error) => void;
  onSubscriptionApplied?: (ctx: SubscriptionEventContext) => void;
}

export class SpacetimeConnector {
  private connection: DbConnection | null = null;
  private identity: Identity | null = null;
  private config: SpacetimeConnectionConfig;
  private callbacks: SpacetimeConnectionCallbacks;
  private subscriptionConfig: SubscriptionConfig;
  private connectionPromise: Promise<DbConnection> | null = null;

  constructor(
    config: SpacetimeConnectionConfig, 
    callbacks?: SpacetimeConnectionCallbacks,
    subscriptionConfig?: SubscriptionConfig
  ) {
    this.config = config;
    this.callbacks = callbacks || {};
    this.subscriptionConfig = subscriptionConfig || { skipAutoSubscribe: true };
  }

  public async connect(): Promise<DbConnection> {
    // Return existing connection if already connected
    if (this.connection) {
      return Promise.resolve(this.connection);
    }

    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Create new connection promise
    this.connectionPromise = new Promise((resolve, reject) => {
      // Add timeout
      const timeoutMs = 30000; // 30 seconds
      const timeout = setTimeout(() => {
        const error = new TimeoutError(
          `Connection to SpacetimeDB timed out after ${timeoutMs}ms`,
          timeoutMs,
          { uri: this.config.uri, module: this.config.moduleName }
        );
        console.error('Connection timeout:', error.message, error.context);
        reject(error);
      }, timeoutMs);

      const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
        clearTimeout(timeout);
        this.connection = conn;
        this.identity = identity;

        // Store auth token
        localStorage.setItem('auth_token', token);
        console.log('Connected to SpacetimeDB with identity:', identity.toHexString());

        // Set up subscriptions based on configuration
        this.setupSubscriptions(conn);

        // Call user callback if provided
        this.callbacks.onConnect?.(conn, identity, token);

        resolve(conn);
      };

      const onDisconnect = () => {
        clearTimeout(timeout);
        console.log('Disconnected from SpacetimeDB');
        this.connection = null;
        this.identity = null;
        this.callbacks.onDisconnect?.();
      };

      const onConnectError = (ctx: ErrorContext, err: Error) => {
        clearTimeout(timeout);
        const connectionError = new ConnectionError(
          `Failed to connect to SpacetimeDB: ${err.message}`,
          {
            uri: this.config.uri,
            module: this.config.moduleName,
            errorContext: ctx,
          },
          err
        );
        console.error(
          'Error connecting to SpacetimeDB:',
          connectionError.message,
          connectionError.context
        );
        this.callbacks.onError?.(ctx, connectionError);
        reject(connectionError);
      };

      DbConnection.builder()
        .withUri(this.config.uri)
        .withModuleName(this.config.moduleName)
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build();
    });

    return this.connectionPromise;
  }

  private setupSubscriptions(conn: DbConnection): void {
    if (this.subscriptionConfig.skipAutoSubscribe) {
      console.log('Skipping automatic subscriptions - manual subscription management enabled');
      return;
    }

    const builder = conn.subscriptionBuilder()
      .onApplied(this.handleSubscriptionApplied.bind(this));

    // Subscribe to specific tables if configured
    if (this.subscriptionConfig.tables && this.subscriptionConfig.tables.length > 0) {
      console.log('Subscribing to specific tables:', this.subscriptionConfig.tables);
      // SpaceTimeDB doesn't support selective table subscriptions directly,
      // so we need to use queries
      const queries = this.subscriptionConfig.tables.map(table => `SELECT * FROM ${table}`);
      builder.subscribe(queries);
    } 
    // Subscribe to custom queries if configured
    else if (this.subscriptionConfig.queries && this.subscriptionConfig.queries.length > 0) {
      console.log('Subscribing with custom queries');
      builder.subscribe(this.subscriptionConfig.queries);
    }
    // If no specific configuration, warn about using subscribeToAllTables
    else {
      console.warn(
        'WARNING: No subscription configuration provided. ' +
        'Consider using selective subscriptions for better performance. ' +
        'Falling back to subscribeToAllTables().'
      );
      builder.subscribeToAllTables();
    }
  }

  private handleSubscriptionApplied(ctx: SubscriptionEventContext): void {
    console.log('Subscription applied!');
    this.callbacks.onSubscriptionApplied?.(ctx);
  }

  public getConnection(): DbConnection | null {
    return this.connection;
  }

  public getIdentity(): Identity | null {
    return this.identity;
  }

  public isConnected(): boolean {
    return this.connection !== null;
  }

  public disconnect(): void {
    if (this.connection) {
      // Note: SpacetimeDB SDK doesn't provide a disconnect method
      // The connection will be closed when the page unloads
      // We can at least clear our references and notify callbacks
      const wasConnected = this.connection !== null;
      
      this.connection = null;
      this.identity = null;
      this.connectionPromise = null;
      
      // Clear auth token
      localStorage.removeItem('auth_token');
      
      // Notify disconnect callback if we were connected
      if (wasConnected) {
        this.callbacks.onDisconnect?.();
        console.log('SpacetimeConnector: Disconnected and cleared references');
      }
    }
  }
}
