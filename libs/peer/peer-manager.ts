import Phaser from "phaser";
import { Peer } from "./peer";
import type {
    Player as PlayerData,
    EventContext,
    DbConnection,
    PlayerMessage,
} from "@/spacetime/client";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

export interface PeerSubscriptionConfig {
    /** Use proximity-based subscriptions to limit peers loaded */
    useProximitySubscription: boolean;
    /** Distance around player to load peers (in pixels) */
    proximityRadius: number;
}

export class PeerManager {
    private scene: Phaser.Scene;
    private peers: Map<string, Peer> = new Map();
    private localPlayerIdentity: Identity | null = null;
    private dbConnection: DbConnection | null = null;
    private levelUpAnimationManager: any = null;
    private chatManager: any = null;

    // Proximity-based subscription configuration
    private subscriptionConfig: PeerSubscriptionConfig;

    // Default configuration
    private static readonly DEFAULT_SUBSCRIPTION_CONFIG: PeerSubscriptionConfig =
        {
            useProximitySubscription: true, // Enable by default for peers
            proximityRadius: 1500, // 1500 pixels around player
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

    /**
     * Set the chat manager for displaying messages from peers
     */
    public setChatManager(manager: any): void {
        this.chatManager = manager;
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
            // Set up event listeners for targeted peer data
            this.setupTargetedPeerEventListeners();

            // Initial proximity subscription
            this.updateProximitySubscription();
            
            // Set up proximity-based message subscription
            this.setupProximityMessageSubscription();

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
        
        // Subscribe to player messages
        this.dbConnection.db.playerMessage.onInsert(this.onPlayerMessageInsert);

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
        
        // Subscribe to player messages (filtered by proximity subscription)
        this.dbConnection.db.playerMessage.onInsert(this.onPlayerMessageInsert);
    }


    /**
     * Update proximity subscription based on current player position
     */
    private updateProximitySubscription(): void {
        if (!this.dbConnection || !this.localPlayerIdentity) return;

        const radius = this.subscriptionConfig.proximityRadius;
        const myIdentity = this.localPlayerIdentity.toHexString();

        try {
            // Subscribe to players within proximity using a self-join with our position
            // This makes the subscription reactive to our own position changes!
            this.dbConnection
                .subscriptionBuilder()
                .onApplied(() => {
                    console.log(
                        `🎯 PeerManager: Proximity subscription applied (radius: ${radius}px)`
                    );
                    // SpacetimeDB will handle insert/delete events for peers entering/leaving the area
                })
                .subscribe([
                    `SELECT * FROM Player 
                     WHERE identity != x'${myIdentity}'
                     AND x BETWEEN ((SELECT x FROM Player WHERE identity = x'${myIdentity}') - ${radius}) 
                                        AND ((SELECT x FROM Player WHERE identity = x'${myIdentity}') + ${radius})
                     AND y BETWEEN ((SELECT y FROM Player WHERE identity = x'${myIdentity}') - ${radius}) 
                                        AND ((SELECT y FROM Player WHERE identity = x'${myIdentity}') + ${radius})`
                ]);
            
            // Also update message subscription using the same self-join pattern
            this.dbConnection
                .subscriptionBuilder()
                .subscribe([
                    `SELECT pm.* FROM PlayerMessage pm
                     JOIN Player p ON pm.playerId = p.identity
                     JOIN Player me ON me.identity = x'${myIdentity}'
                     WHERE p.identity != x'${myIdentity}'
                     AND p.x BETWEEN (me.x - ${radius}) AND (me.x + ${radius})
                     AND p.y BETWEEN (me.y - ${radius}) AND (me.y + ${radius})`
                ]);
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
                Math.pow(player.x - playerPosition.x, 2) +
                    Math.pow(player.y - playerPosition.y, 2)
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
                
                // Clean up any chat UI elements for this peer
                if (this.chatManager) {
                    this.chatManager.clearAllForEntity(peer);
                }
                
                peer.destroy();
                this.peers.delete(identityString);
            }
        }
    }

    /**
     * Set up proximity-based subscription for chat messages
     * Only subscribes to messages from players within proximity radius
     */
    private setupProximityMessageSubscription(): void {
        if (!this.dbConnection || !this.localPlayerIdentity) return;

        const playerPosition = this.getPlayerPosition();
        if (!playerPosition) return;

        const radius = this.subscriptionConfig.proximityRadius;
        const myIdentityHex = this.localPlayerIdentity.toHexString();

        try {
            // Subscribe to messages only from players within proximity using a JOIN
            // This query joins PlayerMessage with Player to filter by distance
            this.dbConnection.subscriptionBuilder()
                .subscribe([
                    `SELECT pm.* FROM PlayerMessage pm
                     JOIN Player p ON pm.playerId = p.identity
                     WHERE p.identity != x'${myIdentityHex}'
                     AND p.x BETWEEN ${playerPosition.x - radius} AND ${playerPosition.x + radius}
                     AND p.y BETWEEN ${playerPosition.y - radius} AND ${playerPosition.y + radius}`
                ]);

            console.log(`📬 PeerManager: Subscribed to messages within ${radius}px radius`);
        } catch (error) {
            console.error("❌ PeerManager: Failed to set up proximity message subscription:", error);
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
            
            // Handle typing indicator updates
            if (this.chatManager) {
                if (newPlayerData.isTyping) {
                    // Show typing indicator for this peer
                    this.chatManager.showPeerTyping(peer);
                } else {
                    // Hide typing indicator for this peer
                    this.chatManager.hidePeerTyping(peer);
                }
            }
        }
    };

    public onPlayerDelete = (
        _ctx: EventContext,
        playerData: PlayerData
    ): void => {
        const identityString = playerData.identity.toHexString();
        const peer = this.peers.get(identityString);

        if (peer) {
            // Clean up any chat UI elements for this peer
            if (this.chatManager) {
                this.chatManager.clearAllForEntity(peer);
            }
            
            peer.destroy();
            this.peers.delete(identityString);
            console.log(
                `Removed peer for player: ${playerData.name} (${identityString})`
            );
        }
    };

    public onPlayerMessageInsert = (
        _ctx: EventContext,
        message: PlayerMessage
    ): void => {
        // Don't handle our own messages
        if (
            this.localPlayerIdentity &&
            message.playerId.isEqual(this.localPlayerIdentity)
        ) {
            return;
        }

        // Find the peer who sent this message
        const identityString = message.playerId.toHexString();
        const peer = this.peers.get(identityString);
        
        if (peer && this.chatManager) {
            // Only show regular messages as speech bubbles, not commands
            if (message.messageType.tag === "Message") {
                // Show speech bubble above the peer
                this.chatManager.showSpeechBubble(peer, message.message);
            } else if (message.messageType.tag === "Command" && message.message.startsWith('/')) {
                // Handle emote commands for peers
                this.handlePeerCommand(peer, message.message);
            }
        }
    };

    private handlePeerCommand(peer: Peer, command: string): void {
        if (!this.chatManager) return;
        
        // For now, just pass through to the chat manager to handle emotes
        // The chat manager already has logic to parse and display emotes
        this.chatManager.showPeerCommand(peer, command);
    }

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
        this.cleanup();
    }
}
