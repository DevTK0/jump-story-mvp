import {
    DbConnection,
    type ErrorContext,
    type SubscriptionEventContext,
} from "@/spacetime/client";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

export interface SpacetimeConnectionConfig {
    uri: string;
    moduleName: string;
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
    private connectionPromise: Promise<DbConnection> | null = null;

    constructor(config: SpacetimeConnectionConfig, callbacks?: SpacetimeConnectionCallbacks) {
        this.config = config;
        this.callbacks = callbacks || {};
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
            const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
                this.connection = conn;
                this.identity = identity;
                
                // Store auth token
                localStorage.setItem("auth_token", token);
                console.log("Connected to SpacetimeDB with identity:", identity.toHexString());

                // Subscribe to all tables
                conn.subscriptionBuilder()
                    .onApplied(this.handleSubscriptionApplied.bind(this))
                    .subscribeToAllTables();

                // Call user callback if provided
                this.callbacks.onConnect?.(conn, identity, token);
                
                resolve(conn);
            };

            const onDisconnect = () => {
                console.log("Disconnected from SpacetimeDB");
                this.connection = null;
                this.identity = null;
                this.callbacks.onDisconnect?.();
            };

            const onConnectError = (ctx: ErrorContext, err: Error) => {
                console.error("Error connecting to SpacetimeDB:", err);
                this.callbacks.onError?.(ctx, err);
                reject(err);
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

    private handleSubscriptionApplied(ctx: SubscriptionEventContext): void {
        console.log("Subscription applied!");
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
            this.connection = null;
            this.identity = null;
        }
    }
}