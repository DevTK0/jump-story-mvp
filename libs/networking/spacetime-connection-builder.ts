import {
    SpacetimeConnector,
    type SpacetimeConnectionConfig,
    type SpacetimeConnectionCallbacks
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
    public onConnect(callback: (connection: DbConnection, identity: Identity, token: string) => void): SpacetimeConnectionBuilder {
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
    public onSubscriptionApplied(callback: (ctx: SubscriptionEventContext) => void): SpacetimeConnectionBuilder {
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
    public withSilentCallbacks(): SpacetimeConnectionBuilder {
        return this
            .onConnect(() => {})
            .onDisconnect(() => {})
            .onError(() => {})
            .onSubscriptionApplied(() => {});
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

        return new SpacetimeConnector(finalConfig, this.callbacks);
    }

    /**
     * Create a preset configuration for local development
     */
    public static createLocal(moduleName: string = 'jump-story'): SpacetimeConnectionBuilder {
        return new SpacetimeConnectionBuilder()
            .setUri('ws://localhost:3000')
            .setModuleName(moduleName)
            .withDefaultCallbacks();
    }

    /**
     * Create a preset configuration for production
     */
    public static createProduction(uri: string, moduleName: string): SpacetimeConnectionBuilder {
        return new SpacetimeConnectionBuilder()
            .setUri(uri)
            .setModuleName(moduleName)
            .withSilentCallbacks(); // Production typically uses silent mode
    }

    /**
     * Create a preset configuration for testing (minimal callbacks)
     */
    public static createTest(moduleName: string = 'jump-story-test'): SpacetimeConnectionBuilder {
        return new SpacetimeConnectionBuilder()
            .setUri('ws://localhost:3001') // Different port for testing
            .setModuleName(moduleName)
            .withSilentCallbacks();
    }
}