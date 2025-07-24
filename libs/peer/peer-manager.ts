import Phaser from "phaser";
import { Peer } from "./peer";
import type {
    Player as PlayerData,
    EventContext,
    DbConnection,
} from "@/spacetime/client";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

export interface PeerSubscriptionConfig {
    /** Use proximity-based subscriptions to limit peers loaded */
    useProximitySubscription: boolean;
    /** Distance around player to load peers (in pixels) */
    proximityRadius: number;
    /** How often to update proximity subscription (in milliseconds) */
    proximityUpdateInterval: number;
}

export class PeerManager {
    private scene: Phaser.Scene;
    private peers: Map<string, Peer> = new Map();
    private localPlayerIdentity: Identity | null = null;
    private dbConnection: DbConnection | null = null;
    private levelUpAnimationManager: any = null;

    // Proximity-based subscription configuration
    private subscriptionConfig: PeerSubscriptionConfig;
    private proximityUpdateTimer: Phaser.Time.TimerEvent | null = null;
    private lastPlayerPosition: { x: number; y: number } | null = null;

    // Default configuration
    private static readonly DEFAULT_SUBSCRIPTION_CONFIG: PeerSubscriptionConfig =
        {
            useProximitySubscription: true, // Enable by default for peers
            proximityRadius: 200, // 1500 pixels around player
            proximityUpdateInterval: 100, // Update every 3 seconds
        };

    constructor(
        scene: Phaser.Scene,
        subscriptionConfig?: Partial<PeerSubscriptionConfig>
    ) {
        this.scene = scene;
        this.subscriptionConfig = {
            ...PeerManager.DEFAULT_SUBSCRIPTION_CONFIG,
            ...subscriptionConfig,
        };
    }

    public setLocalPlayerIdentity(identity: Identity): void {
        this.localPlayerIdentity = identity;
    }

    public setDbConnection(connection: DbConnection): void {
        this.dbConnection = connection;
        this.setupServerSubscriptions();
    }

    /**
     * Set the level up animation manager for registering peer sprites
     */
    public setLevelUpAnimationManager(manager: any): void {
        this.levelUpAnimationManager = manager;
        
        // Register any existing peer sprites
        for (const [_identityString, peer] of this.peers) {
            const playerData = peer.getPlayerData();
            manager.registerSprite(playerData.identity, peer);
        }
    }

    private setupServerSubscriptions(): void {
        if (!this.dbConnection) return;

        if (this.subscriptionConfig.useProximitySubscription) {
            this.setupProximityBasedSubscription();
        } else {
            this.setupGlobalSubscription();
        }
    }

    /**
     * Set up proximity-based subscription for better scalability
     * Only loads peers within a certain radius of the player
     */
    private setupProximityBasedSubscription(): void {
        if (!this.dbConnection) return;

        try {
            // Start proximity subscription timer
            this.startProximityUpdateTimer();

            // Set up event listeners for targeted peer data
            this.setupTargetedPeerEventListeners();

            // Initial proximity subscription
            this.updateProximitySubscription();

            console.log("✅ PeerManager: Proximity-based subscription active");
        } catch (error) {
            console.error(
                "❌ PeerManager: Failed to set up proximity subscription:",
                error
            );
            // Fall back to global subscription
            this.setupGlobalSubscription();
        }
    }

    /**
     * Set up global subscription (original behavior)
     * Subscribes to all players in the game world
     */
    private setupGlobalSubscription(): void {
        if (!this.dbConnection) return;

        // Use the existing event handlers
        this.dbConnection.db.player.onInsert(this.onPlayerInsert);
        this.dbConnection.db.player.onUpdate(this.onPlayerUpdate);
        this.dbConnection.db.player.onDelete(this.onPlayerDelete);

        console.log("✅ PeerManager: Global subscription active");
    }

    /**
     * Set up event listeners for proximity-based peer subscription
     */
    private setupTargetedPeerEventListeners(): void {
        if (!this.dbConnection) return;

        // With proximity subscription, events will only fire for nearby players
        this.dbConnection.db.player.onInsert(this.onPlayerInsert);
        this.dbConnection.db.player.onUpdate(this.onPlayerUpdate);
        this.dbConnection.db.player.onDelete(this.onPlayerDelete);
    }

    /**
     * Start timer to periodically update proximity subscription based on player movement
     */
    private startProximityUpdateTimer(): void {
        if (this.proximityUpdateTimer) {
            this.proximityUpdateTimer.destroy();
        }

        this.proximityUpdateTimer = this.scene.time.addEvent({
            delay: this.subscriptionConfig.proximityUpdateInterval,
            loop: true,
            callback: this.updateProximitySubscription,
            callbackScope: this,
        });
    }

    /**
     * Update proximity subscription based on current player position
     */
    private updateProximitySubscription(): void {
        if (!this.dbConnection || !this.localPlayerIdentity) return;

        // Get player position
        const playerPosition = this.getPlayerPosition();
        if (!playerPosition) {
            console.warn(
                "⚠️ PeerManager: Cannot update proximity subscription - player position unknown"
            );
            return;
        }

        // Check if player has moved significantly since last update
        if (
            this.lastPlayerPosition &&
            Math.abs(playerPosition.x - this.lastPlayerPosition.x) < 100 &&
            Math.abs(playerPosition.y - this.lastPlayerPosition.y) < 100
        ) {
            // Player hasn't moved much, but still check for peers to remove
            this.loadProximityPeers();
            return;
        }

        const radius = this.subscriptionConfig.proximityRadius;
        const minX = playerPosition.x - radius;
        const maxX = playerPosition.x + radius;
        const minY = playerPosition.y - radius;
        const maxY = playerPosition.y + radius;
        const myIdentity = this.localPlayerIdentity.toHexString();

        try {
            // Subscribe to players within proximity, excluding ourselves
            this.dbConnection
                .subscriptionBuilder()
                .onApplied(() => {
                    console.log(
                        "🎯 PeerManager: Proximity subscription applied"
                    );
                    this.loadProximityPeers();
                })
                .subscribe([
                    `SELECT * FROM Player WHERE position.x BETWEEN ${minX} AND ${maxX} AND position.y BETWEEN ${minY} AND ${maxY} AND identity != x'${myIdentity}'`,
                ]);

            this.lastPlayerPosition = { ...playerPosition };
        } catch (error) {
            console.error(
                "❌ PeerManager: Failed to update proximity subscription:",
                error
            );
        }
    }

    /**
     * Load existing peers within proximity when subscription is applied
     * Also removes peers that are now outside the proximity area
     */
    private loadProximityPeers(): void {
        if (!this.dbConnection || !this.localPlayerIdentity) return;

        const playerPosition = this.getPlayerPosition();
        if (!playerPosition) return;

        const radius = this.subscriptionConfig.proximityRadius;
        const currentPeerIdentities = new Set<string>();
        const myIdentityHex = this.localPlayerIdentity.toHexString();

        // Load peers that are within proximity
        for (const player of this.dbConnection.db.player.iter()) {
            // Skip local player
            if (player.identity.toHexString() === myIdentityHex) {
                continue;
            }

            const distance = Math.sqrt(
                Math.pow(player.position.x - playerPosition.x, 2) +
                    Math.pow(player.position.y - playerPosition.y, 2)
            );

            const identityString = player.identity.toHexString();

            if (distance <= radius) {
                currentPeerIdentities.add(identityString);
                if (!this.peers.has(identityString)) {
                    console.log(
                        `🎯 PeerManager: Loading nearby peer ${
                            player.name
                        } at distance ${Math.round(distance)}`
                    );
                    // Create peer manually since onPlayerInsert might not fire for existing players
                    const peer = new Peer({
                        scene: this.scene,
                        playerData: player,
                    });
                    this.peers.set(identityString, peer);
                    
                    // Register peer sprite with level up animation manager
                    if (this.levelUpAnimationManager) {
                        this.levelUpAnimationManager.registerSprite(player.identity, peer);
                    }
                }
            }
        }

        // Remove peers that are no longer in proximity
        for (const [identityString, peer] of this.peers) {
            if (!currentPeerIdentities.has(identityString)) {
                console.log(
                    `🎯 PeerManager: Removing peer ${
                        peer.getPlayerData().name
                    } - now outside proximity`
                );
                peer.destroy();
                this.peers.delete(identityString);
            }
        }
    }

    /**
     * Get current player position from the scene
     */
    private getPlayerPosition(): { x: number; y: number } | null {
        // Try to get player from scene data
        const playgroundScene = this.scene as any;
        if (
            playgroundScene.player &&
            playgroundScene.player.x !== undefined &&
            playgroundScene.player.y !== undefined
        ) {
            return {
                x: playgroundScene.player.x,
                y: playgroundScene.player.y,
            };
        }

        // Fallback to camera center if player not accessible
        if (this.scene.cameras && this.scene.cameras.main) {
            const camera = this.scene.cameras.main;
            return {
                x: camera.centerX,
                y: camera.centerY,
            };
        }

        return null;
    }

    public onPlayerInsert = (
        _ctx: EventContext,
        playerData: PlayerData
    ): void => {
        // Don't create peer for local player
        if (
            this.localPlayerIdentity &&
            playerData.identity.isEqual(this.localPlayerIdentity)
        ) {
            return;
        }

        const identityString = playerData.identity.toHexString();

        // Don't create duplicate peers
        if (this.peers.has(identityString)) {
            return;
        }

        // Create new peer
        const peer = new Peer({ scene: this.scene, playerData });
        this.peers.set(identityString, peer);
        
        // Register peer sprite with level up animation manager
        if (this.levelUpAnimationManager) {
            this.levelUpAnimationManager.registerSprite(playerData.identity, peer);
        }

        console.log(
            `Created peer for player: ${playerData.name} (${identityString})`
        );
    };

    public onPlayerUpdate = (
        _ctx: EventContext,
        _oldPlayerData: PlayerData,
        newPlayerData: PlayerData
    ): void => {
        // Don't update local player
        if (
            this.localPlayerIdentity &&
            newPlayerData.identity.isEqual(this.localPlayerIdentity)
        ) {
            return;
        }

        const identityString = newPlayerData.identity.toHexString();
        const peer = this.peers.get(identityString);

        if (peer) {
            peer.updateFromData(newPlayerData);
        }
    };

    public onPlayerDelete = (
        _ctx: EventContext,
        playerData: PlayerData
    ): void => {
        const identityString = playerData.identity.toHexString();
        const peer = this.peers.get(identityString);

        if (peer) {
            peer.destroy();
            this.peers.delete(identityString);
            console.log(
                `Removed peer for player: ${playerData.name} (${identityString})`
            );
        }
    };

    public getPeerCount(): number {
        return this.peers.size;
    }

    public getAllPeers(): Peer[] {
        return Array.from(this.peers.values());
    }

    public update(): void {
        // Update all peers for smooth interpolation
        for (const peer of this.peers.values()) {
            peer.update();
        }
    }

    public cleanup(): void {
        // Clean up all peers
        for (const peer of this.peers.values()) {
            peer.destroy();
        }
        this.peers.clear();
    }

    public destroy(): void {
        // Clean up proximity timer if it exists
        if (this.proximityUpdateTimer) {
            this.proximityUpdateTimer.destroy();
            this.proximityUpdateTimer = null;
        }

        this.cleanup();
    }
}
