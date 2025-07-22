import {
    DatabaseConnectionManager,
    type DatabaseConnectionConfig,
    type DatabaseConnectionCallbacks
} from './database-connection-manager';
import { DbConnection, type ErrorContext, type SubscriptionEventContext } from '../module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

/**
 * Builder pattern implementation for creating configured DatabaseConnectionManager instances.
 * Provides a fluent API for step-by-step database connection configuration.
 * 
 * Usage:
 * ```typescript
 * const manager = new DatabaseConnectionBuilder()
 *   .setUri('ws://localhost:3000')
 *   .setModuleName('jump-story')
 *   .onConnect((conn, identity, token) => console.log('Connected!'))
 *   .onError((ctx, error) => console.error('Error:', error))
 *   .build();
 * ```
 */
export class DatabaseConnectionBuilder {
    private config: Partial<DatabaseConnectionConfig> = {};
    private callbacks: DatabaseConnectionCallbacks = {};

    /**
     * Set the WebSocket URI for the database connection
     */
    public setUri(uri: string): DatabaseConnectionBuilder {
        this.config.uri = uri;
        return this;
    }

    /**
     * Set the SpacetimeDB module name
     */
    public setModuleName(moduleName: string): DatabaseConnectionBuilder {
        this.config.moduleName = moduleName;
        return this;
    }

    /**
     * Set the complete connection configuration
     */
    public setConfig(config: DatabaseConnectionConfig): DatabaseConnectionBuilder {
        this.config = { ...config };
        return this;
    }

    /**
     * Set callback for successful connection events
     */
    public onConnect(callback: (connection: DbConnection, identity: Identity, token: string) => void): DatabaseConnectionBuilder {
        this.callbacks.onConnect = callback;
        return this;
    }

    /**
     * Set callback for disconnection events
     */
    public onDisconnect(callback: () => void): DatabaseConnectionBuilder {
        this.callbacks.onDisconnect = callback;
        return this;
    }

    /**
     * Set callback for connection error events
     */
    public onError(callback: (ctx: ErrorContext, error: Error) => void): DatabaseConnectionBuilder {
        this.callbacks.onError = callback;
        return this;
    }

    /**
     * Set callback for subscription applied events
     */
    public onSubscriptionApplied(callback: (ctx: SubscriptionEventContext) => void): DatabaseConnectionBuilder {
        this.callbacks.onSubscriptionApplied = callback;
        return this;
    }

    /**
     * Set all callbacks at once
     */
    public setCallbacks(callbacks: DatabaseConnectionCallbacks): DatabaseConnectionBuilder {
        this.callbacks = { ...callbacks };
        return this;
    }

    /**
     * Configure with default development callbacks (console logging)
     */
    public withDefaultCallbacks(): DatabaseConnectionBuilder {
        return this
            .onConnect((_conn, identity, token) => {
                console.log('Connected to SpacetimeDB:', {
                    identity: identity.toHexString(),
                    token: token.substring(0, 8) + '...',
                });
            })
            .onDisconnect(() => {
                console.log('Disconnected from SpacetimeDB');
            })
            .onError((_ctx, error) => {
                console.error('SpacetimeDB connection error:', error);
            })
            .onSubscriptionApplied(() => {
                console.log('SpacetimeDB subscription applied');
            });
    }

    /**
     * Configure with silent callbacks (no console output)
     */
    public withSilentCallbacks(): DatabaseConnectionBuilder {
        return this
            .onConnect(() => {})
            .onDisconnect(() => {})
            .onError(() => {})
            .onSubscriptionApplied(() => {});
    }

    /**
     * Build and return the configured DatabaseConnectionManager instance
     */
    public build(): DatabaseConnectionManager {
        // Validate required configuration
        if (!this.config.uri) {
            throw new Error('DatabaseConnectionBuilder: URI is required');
        }
        if (!this.config.moduleName) {
            throw new Error('DatabaseConnectionBuilder: Module name is required');
        }

        const finalConfig: DatabaseConnectionConfig = {
            uri: this.config.uri,
            moduleName: this.config.moduleName,
        };

        return new DatabaseConnectionManager(finalConfig, this.callbacks);
    }

    /**
     * Create a preset configuration for local development
     */
    public static createLocal(moduleName: string = 'jump-story'): DatabaseConnectionBuilder {
        return new DatabaseConnectionBuilder()
            .setUri('ws://localhost:3000')
            .setModuleName(moduleName)
            .withDefaultCallbacks();
    }

    /**
     * Create a preset configuration for production
     */
    public static createProduction(uri: string, moduleName: string): DatabaseConnectionBuilder {
        return new DatabaseConnectionBuilder()
            .setUri(uri)
            .setModuleName(moduleName)
            .withSilentCallbacks(); // Production typically uses silent mode
    }

    /**
     * Create a preset configuration for testing (minimal callbacks)
     */
    public static createTest(moduleName: string = 'jump-story-test'): DatabaseConnectionBuilder {
        return new DatabaseConnectionBuilder()
            .setUri('ws://localhost:3001') // Different port for testing
            .setModuleName(moduleName)
            .withSilentCallbacks();
    }
}