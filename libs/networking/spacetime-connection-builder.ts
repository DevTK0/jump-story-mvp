import {
  SpacetimeConnector,
  type SpacetimeConnectionConfig,
  type SpacetimeConnectionCallbacks,
  type SubscriptionConfig,
} from './spacetime-connector';
import { DbConnection, type ErrorContext, type SubscriptionEventContext } from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

/**
 * Builder pattern implementation for creating configured SpacetimeConnector instances.
 * Provides a fluent API for step-by-step database connection configuration.
 *
 * Usage:
 * ```typescript
 * const connector = new SpacetimeConnectionBuilder()
 *   .setUri('ws://localhost:3000')
 *   .setModuleName('jump-story')
 *   .onConnect((conn, identity, token) => console.log('Connected!'))
 *   .onError((ctx, error) => console.error('Error:', error))
 *   .build();
 * ```
 */
export class SpacetimeConnectionBuilder {
  private config: Partial<SpacetimeConnectionConfig> = {};
  private callbacks: SpacetimeConnectionCallbacks = {};
  private subscriptionConfig: SubscriptionConfig = { skipAutoSubscribe: true };

  /**
   * Set the WebSocket URI for the database connection
   */
  public setUri(uri: string): SpacetimeConnectionBuilder {
    this.config.uri = uri;
    return this;
  }

  /**
   * Set the SpacetimeDB module name
   */
  public setModuleName(moduleName: string): SpacetimeConnectionBuilder {
    this.config.moduleName = moduleName;
    return this;
  }

  /**
   * Set the complete connection configuration
   */
  public setConfig(config: SpacetimeConnectionConfig): SpacetimeConnectionBuilder {
    this.config = { ...config };
    return this;
  }

  /**
   * Set callback for successful connection events
   */
  public onConnect(
    callback: (connection: DbConnection, identity: Identity, token: string) => void
  ): SpacetimeConnectionBuilder {
    this.callbacks.onConnect = callback;
    return this;
  }

  /**
   * Set callback for disconnection events
   */
  public onDisconnect(callback: () => void): SpacetimeConnectionBuilder {
    this.callbacks.onDisconnect = callback;
    return this;
  }

  /**
   * Set callback for connection error events
   */
  public onError(callback: (ctx: ErrorContext, error: Error) => void): SpacetimeConnectionBuilder {
    this.callbacks.onError = callback;
    return this;
  }

  /**
   * Set callback for subscription applied events
   */
  public onSubscriptionApplied(
    callback: (ctx: SubscriptionEventContext) => void
  ): SpacetimeConnectionBuilder {
    this.callbacks.onSubscriptionApplied = callback;
    return this;
  }

  /**
   * Set all callbacks at once
   */
  public setCallbacks(callbacks: SpacetimeConnectionCallbacks): SpacetimeConnectionBuilder {
    this.callbacks = { ...callbacks };
    return this;
  }

  /**
   * Configure with default development callbacks (console logging)
   */
  public withDefaultCallbacks(): SpacetimeConnectionBuilder {
    return this.onConnect((_conn, _identity, _token) => {
      // Connection established
    })
      .onDisconnect(() => {
        // Disconnected
      })
      .onError((_ctx, error) => {
        console.error('SpacetimeDB connection error:', error);
      })
      .onSubscriptionApplied(() => {
        // Subscription applied
      });
  }

  /**
   * Configure with silent callbacks (no console output)
   */
  public withSilentCallbacks(): SpacetimeConnectionBuilder {
    return this.onConnect(() => {})
      .onDisconnect(() => {})
      .onError(() => {})
      .onSubscriptionApplied(() => {});
  }

  /**
   * Configure subscription settings
   */
  public setSubscriptionConfig(config: SubscriptionConfig): SpacetimeConnectionBuilder {
    this.subscriptionConfig = { ...config };
    return this;
  }

  /**
   * Skip automatic subscriptions (recommended for manual subscription management)
   */
  public skipAutoSubscribe(): SpacetimeConnectionBuilder {
    this.subscriptionConfig.skipAutoSubscribe = true;
    return this;
  }

  /**
   * Subscribe to specific tables only
   */
  public subscribeTo(...tables: string[]): SpacetimeConnectionBuilder {
    this.subscriptionConfig.skipAutoSubscribe = false;
    this.subscriptionConfig.tables = tables;
    return this;
  }

  /**
   * Subscribe to core tables required by multiple systems
   * This includes Job, PlayerJob, JobAttack, Spawn (unified for enemies and bosses), Enemy, Boss tables, PlayerLevel, PlayerMessage, Leaderboard, Broadcast, party tables, and damage event tables
   * Note: Player table is handled separately by PeerManager with proximity-based subscriptions
   */
  public subscribeToCoreTables(): SpacetimeConnectionBuilder {
    this.subscriptionConfig.skipAutoSubscribe = false;
    this.subscriptionConfig.tables = [
      'Job', 
      'PlayerJob', 
      'JobAttack',
      'Spawn',         // Unified table for both enemies and bosses
      'Enemy',
      'Boss',          // Boss configuration data
      'PlayerDamageEvent',
      'EnemyDamageEvent', // Handles both enemy and boss damage since using unified DamageEnemy reducer
      'PlayerLevel',  // Configuration table for level requirements
      'PlayerMessage', // Chat messages and emotes
      'Leaderboard',   // Top 10 players leaderboard
      'Broadcast',     // Server-wide broadcast messages
      'Party',         // Party system tables
      'PartyMember',
      'PartyInvite',
    ];
    return this;
  }

  /**
   * Subscribe with custom SQL queries
   */
  public subscribeWithQueries(...queries: string[]): SpacetimeConnectionBuilder {
    this.subscriptionConfig.skipAutoSubscribe = false;
    this.subscriptionConfig.queries = queries;
    return this;
  }

  /**
   * Build and return the configured SpacetimeConnector instance
   */
  public build(): SpacetimeConnector {
    // Validate required configuration
    if (!this.config.uri) {
      throw new Error('SpacetimeConnectionBuilder: URI is required');
    }
    if (!this.config.moduleName) {
      throw new Error('SpacetimeConnectionBuilder: Module name is required');
    }

    const finalConfig: SpacetimeConnectionConfig = {
      uri: this.config.uri,
      moduleName: this.config.moduleName,
    };

    return new SpacetimeConnector(finalConfig, this.callbacks, this.subscriptionConfig);
  }

  /**
   * Create a preset configuration for local development
   */
  public static createLocal(moduleName: string = 'jump-story'): SpacetimeConnectionBuilder {
    return new SpacetimeConnectionBuilder()
      .setUri('ws://localhost:3000')
      .setModuleName(moduleName)
      .withDefaultCallbacks()
      .skipAutoSubscribe(); // Let individual managers handle subscriptions
  }

  /**
   * Create a preset configuration for production
   */
  public static createProduction(uri: string, moduleName: string): SpacetimeConnectionBuilder {
    return new SpacetimeConnectionBuilder()
      .setUri(uri)
      .setModuleName(moduleName)
      .withSilentCallbacks() // Production typically uses silent mode
      .skipAutoSubscribe(); // Let individual managers handle subscriptions
  }

  /**
   * Create a preset configuration for testing (minimal callbacks)
   */
  public static createTest(moduleName: string = 'jump-story-test'): SpacetimeConnectionBuilder {
    return new SpacetimeConnectionBuilder()
      .setUri('ws://localhost:3001') // Different port for testing
      .setModuleName(moduleName)
      .withSilentCallbacks()
      .skipAutoSubscribe(); // No automatic subscriptions for tests
  }
}
