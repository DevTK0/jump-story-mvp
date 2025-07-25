import Phaser from 'phaser';
import { Peer } from './peer';
import type {
  Player as PlayerData,
  EventContext,
  DbConnection,
  PlayerMessage,
} from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

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
  private chatManager: any = null;

  // Proximity-based subscription configuration
  private subscriptionConfig: PeerSubscriptionConfig;
  private proximityUpdateTimer?: Phaser.Time.TimerEvent;
  private lastSubscriptionCenter: { x: number; y: number } | null = null;

  // Default configuration
  private static readonly DEFAULT_SUBSCRIPTION_CONFIG: PeerSubscriptionConfig = {
    useProximitySubscription: true, // Enable by default for peers
    proximityRadius: 1500, // 1500 pixels around player
    proximityUpdateInterval: 5000, // Update subscription every 5 seconds
  };

  constructor(scene: Phaser.Scene, subscriptionConfig?: Partial<PeerSubscriptionConfig>) {
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

      // Set up distance-based proximity checking
      this.setupDistanceBasedProximityUpdate();

      console.log('✅ PeerManager: Proximity-based subscription active');
    } catch (error) {
      console.error('❌ PeerManager: Failed to set up proximity subscription:', error);
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

    console.log('✅ PeerManager: Global subscription active');
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

    // Get player position
    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) {
      console.warn(
        '⚠️ PeerManager: Cannot update proximity subscription - player position unknown'
      );
      return;
    }

    // Update the last subscription center
    this.lastSubscriptionCenter = { x: playerPosition.x, y: playerPosition.y };

    const radius = this.subscriptionConfig.proximityRadius;
    const myIdentity = this.localPlayerIdentity.toHexString();

    try {
      // Subscribe to players within proximity using a self-join with our position
      // This makes the subscription reactive to our own position changes!
      this.dbConnection
        .subscriptionBuilder()
        .onApplied(() => {
          console.log(
            `🎯 PeerManager: Proximity subscription applied for area (${playerPosition.x - radius},${playerPosition.y - radius}) to (${playerPosition.x + radius},${playerPosition.y + radius})`
          );
          // Load existing peers within proximity
          this.loadProximityPeers();
        })
        .subscribe([
          `SELECT * FROM Player 
                     WHERE identity != x'${myIdentity}'
                     AND x >= ${playerPosition.x - radius} AND x <= ${playerPosition.x + radius}
                     AND y >= ${playerPosition.y - radius} AND y <= ${playerPosition.y + radius}`,
        ]);

      // Also update message subscription for the new area
      // Only subscribe to messages from the last 30 seconds (typical message display duration)
      const messageAgeLimit = 30000; // 30 seconds in milliseconds
      const cutoffTimeMicros = (Date.now() - messageAgeLimit) * 1000; // Convert to microseconds

      this.dbConnection.subscriptionBuilder().subscribe([
        `SELECT pm.* FROM PlayerMessage pm
                     JOIN Player p ON pm.player_id = p.identity
                     WHERE p.identity != x'${myIdentity}'
                     AND p.x >= ${playerPosition.x - radius} AND p.x <= ${playerPosition.x + radius}
                     AND p.y >= ${playerPosition.y - radius} AND p.y <= ${playerPosition.y + radius}
                     AND pm.sent_dt >= ${cutoffTimeMicros}i64`,
      ]);
    } catch (error) {
      console.error('❌ PeerManager: Failed to update proximity subscription:', error);
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
        Math.pow(player.x - playerPosition.x, 2) + Math.pow(player.y - playerPosition.y, 2)
      );

      const identityString = player.identity.toHexString();

      if (distance <= radius) {
        currentPeerIdentities.add(identityString);
        if (!this.peers.has(identityString)) {
          console.log(
            `🎯 PeerManager: Loading nearby peer ${player.name} at distance ${Math.round(distance)}`
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

          // Don't load recent messages - we only want to show new messages
          // this.loadRecentMessagesForPeer(player.identity);
        }
      }
    }

    // Remove peers that are no longer in proximity
    for (const [identityString, peer] of this.peers) {
      if (!currentPeerIdentities.has(identityString)) {
        console.log(
          `🎯 PeerManager: Removing peer ${peer.getPlayerData().name} - now outside proximity`
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
      // Only subscribe to messages from the last 30 seconds (typical message display duration)
      const messageAgeLimit = 30000; // 30 seconds in milliseconds
      const cutoffTimeMicros = (Date.now() - messageAgeLimit) * 1000; // Convert to microseconds

      this.dbConnection.subscriptionBuilder().subscribe([
        `SELECT pm.* FROM PlayerMessage pm
                     JOIN Player p ON pm.player_id = p.identity
                     WHERE p.identity != x'${myIdentityHex}'
                     AND p.x >= ${playerPosition.x - radius} AND p.x <= ${playerPosition.x + radius}
                     AND p.y >= ${playerPosition.y - radius} AND p.y <= ${playerPosition.y + radius}
                     AND pm.sent_dt >= ${cutoffTimeMicros}i64`,
      ]);

      console.log(
        `📬 PeerManager: Subscribed to messages within ${radius}px radius from last 30 seconds`
      );
    } catch (error) {
      console.error('❌ PeerManager: Failed to set up proximity message subscription:', error);
    }
  }

  /**
   * Set up distance-based proximity update checking
   * Updates subscription when player moves more than 1/4 of the proximity radius
   */
  private setupDistanceBasedProximityUpdate(): void {
    // Check player position every frame for distance-based updates
    this.scene.events.on('update', this.checkProximityDistanceUpdate, this);
  }

  /**
   * Check if player has moved far enough to warrant a proximity subscription update
   */
  private checkProximityDistanceUpdate(): void {
    if (!this.dbConnection || !this.localPlayerIdentity) return;

    const playerPosition = this.getPlayerPosition();
    if (!playerPosition) return;

    // Calculate distance threshold (1/4 of proximity radius)
    const updateThreshold = this.subscriptionConfig.proximityRadius * 0.25;

    // Check if we need to update based on distance moved
    if (this.lastSubscriptionCenter) {
      const distanceMoved = Math.sqrt(
        Math.pow(playerPosition.x - this.lastSubscriptionCenter.x, 2) +
          Math.pow(playerPosition.y - this.lastSubscriptionCenter.y, 2)
      );

      if (distanceMoved >= updateThreshold) {
        console.log(
          `📍 PeerManager: Player moved ${Math.round(distanceMoved)}px, updating proximity subscription`
        );
        this.updateProximitySubscription();
        this.setupProximityMessageSubscription();
      }
    } else {
      // First time - set initial center
      this.updateProximitySubscription();
      this.setupProximityMessageSubscription();
    }
  }

  /**
   * Stop the proximity update timer
   */
  private stopProximityUpdateTimer(): void {
    if (this.proximityUpdateTimer) {
      this.proximityUpdateTimer.destroy();
      this.proximityUpdateTimer = undefined;
    }
    // Clean up distance-based update listener
    this.scene.events.off('update', this.checkProximityDistanceUpdate, this);
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

  public onPlayerInsert = (_ctx: EventContext, playerData: PlayerData): void => {
    // Don't create peer for local player
    if (this.localPlayerIdentity && playerData.identity.isEqual(this.localPlayerIdentity)) {
      return;
    }

    const identityString = playerData.identity.toHexString();

    // Don't create duplicate peers
    if (this.peers.has(identityString)) {
      return;
    }

    // If using proximity subscription, check if player is within range
    if (this.subscriptionConfig.useProximitySubscription) {
      const playerPosition = this.getPlayerPosition();
      if (playerPosition) {
        const distance = Math.sqrt(
          Math.pow(playerData.x - playerPosition.x, 2) +
            Math.pow(playerData.y - playerPosition.y, 2)
        );

        if (distance > this.subscriptionConfig.proximityRadius) {
          console.log(
            `⚠️ PeerManager: Ignoring player ${playerData.name} - outside proximity (distance: ${Math.round(distance)}px)`
          );
          return;
        }
      }
    }

    // Create new peer
    const peer = new Peer({ scene: this.scene, playerData });
    this.peers.set(identityString, peer);

    // Register peer sprite with level up animation manager
    if (this.levelUpAnimationManager) {
      this.levelUpAnimationManager.registerSprite(playerData.identity, peer);
    }

    console.log(`Created peer for player: ${playerData.name} (${identityString})`);

    // Don't load recent messages - we only want to show new messages
    // this.loadRecentMessagesForPeer(playerData.identity);
  };

  public onPlayerUpdate = (
    _ctx: EventContext,
    _oldPlayerData: PlayerData,
    newPlayerData: PlayerData
  ): void => {
    // Don't update local player
    if (this.localPlayerIdentity && newPlayerData.identity.isEqual(this.localPlayerIdentity)) {
      return;
    }

    const identityString = newPlayerData.identity.toHexString();
    const peer = this.peers.get(identityString);

    // Check proximity if using proximity subscription
    if (this.subscriptionConfig.useProximitySubscription) {
      const playerPosition = this.getPlayerPosition();
      if (playerPosition) {
        const distance = Math.sqrt(
          Math.pow(newPlayerData.x - playerPosition.x, 2) +
            Math.pow(newPlayerData.y - playerPosition.y, 2)
        );

        const isWithinProximity = distance <= this.subscriptionConfig.proximityRadius;

        if (peer && !isWithinProximity) {
          // Peer exists but is now outside proximity - remove them
          console.log(
            `🚪 PeerManager: Removing peer ${newPlayerData.name} - now outside proximity (distance: ${Math.round(distance)}px)`
          );

          // Clean up any chat UI elements for this peer
          if (this.chatManager) {
            this.chatManager.clearAllForEntity(peer);
          }

          peer.destroy();
          this.peers.delete(identityString);
          return;
        } else if (!peer && isWithinProximity) {
          // Peer doesn't exist but is now within proximity - create them
          console.log(
            `👋 PeerManager: Player ${newPlayerData.name} entered proximity (distance: ${Math.round(distance)}px)`
          );

          // Create new peer
          const newPeer = new Peer({ scene: this.scene, playerData: newPlayerData });
          this.peers.set(identityString, newPeer);

          // Register peer sprite with level up animation manager
          if (this.levelUpAnimationManager) {
            this.levelUpAnimationManager.registerSprite(newPlayerData.identity, newPeer);
          }

          // Don't load recent messages - we only want to show new messages
          // this.loadRecentMessagesForPeer(newPlayerData.identity);
          return;
        }
      }
    }

    // Update existing peer if they exist
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

  public onPlayerDelete = (_ctx: EventContext, playerData: PlayerData): void => {
    const identityString = playerData.identity.toHexString();
    const peer = this.peers.get(identityString);

    if (peer) {
      // Clean up any chat UI elements for this peer
      if (this.chatManager) {
        this.chatManager.clearAllForEntity(peer);
      }

      peer.destroy();
      this.peers.delete(identityString);
      console.log(`Removed peer for player: ${playerData.name} (${identityString})`);
    }
  };

  public onPlayerMessageInsert = (_ctx: EventContext, message: PlayerMessage): void => {
    // Don't handle our own messages
    if (this.localPlayerIdentity && message.playerId.isEqual(this.localPlayerIdentity)) {
      return;
    }

    // Check if message is older than the display duration (5 seconds - default speech bubble duration)
    const messageDisplayDuration = 5000; // 5 seconds in milliseconds
    const currentTimeMicros = Date.now() * 1000; // Convert to microseconds
    const messageTimeMicros = Number(message.sentDt); // Timestamp is in microseconds
    const messageAgeMs = (currentTimeMicros - messageTimeMicros) / 1000; // Convert back to milliseconds

    if (messageAgeMs > messageDisplayDuration) {
      // Message is too old, don't display it
      console.log(
        `⏰ PeerManager: Ignoring message older than ${messageDisplayDuration / 1000}s (age: ${Math.round(messageAgeMs / 1000)}s)`
      );
      return;
    }

    // Find the peer who sent this message
    const identityString = message.playerId.toHexString();
    const peer = this.peers.get(identityString);

    if (peer && this.chatManager) {
      // Only show regular messages as speech bubbles, not commands
      if (message.messageType.tag === 'Message') {
        // Show speech bubble above the peer
        this.chatManager.showSpeechBubble(peer, message.message);
      } else if (message.messageType.tag === 'Command' && message.message.startsWith('/')) {
        // Handle emote commands for peers
        this.handlePeerCommand(peer, message.message);
      }
    }
    // Note: Messages from players not in proximity are intentionally ignored
    // They won't have a peer object and thus won't be displayed
  };

  private handlePeerCommand(peer: Peer, command: string): void {
    if (!this.chatManager) return;

    // For now, just pass through to the chat manager to handle emotes
    // The chat manager already has logic to parse and display emotes
    this.chatManager.showPeerCommand(peer, command);
  }

  /**
   * Load recent messages for a peer that just entered proximity
   * This ensures we see their recent chat messages even if they were sent while outside range
   *
   * NOTE: Currently disabled as we don't want to show old messages
   */
  // private loadRecentMessagesForPeer(peerIdentity: Identity): void {
  //     if (!this.dbConnection || !this.chatManager) return;
  //
  //     const peer = this.peers.get(peerIdentity.toHexString());
  //     if (!peer) return;
  //
  //     // Get the most recent message from this player (if any)
  //     // We'll only show the latest message to avoid spam when entering proximity
  //     let latestMessage: PlayerMessage | null = null;
  //
  //     for (const message of this.dbConnection.db.playerMessage.iter()) {
  //         if (message.playerId.isEqual(peerIdentity)) {
  //             // Assuming messages have a timestamp or we can use the order
  //             // For now, we'll just get the last one we find (they should be ordered)
  //             latestMessage = message;
  //         }
  //     }
  //
  //     if (latestMessage) {
  //         // Check if message is older than the display duration (5 seconds - default speech bubble duration)
  //         const messageDisplayDuration = 5000; // 5 seconds in milliseconds
  //         const currentTimeMicros = Date.now() * 1000; // Convert to microseconds
  //         const messageTimeMicros = Number(latestMessage.sentDt); // Timestamp is in microseconds
  //         const messageAgeMs = (currentTimeMicros - messageTimeMicros) / 1000; // Convert back to milliseconds
  //
  //         if (messageAgeMs > messageDisplayDuration) {
  //             // Message is too old, don't display it
  //             console.log(`⏰ PeerManager: Not showing old message from ${peer.getPlayerData().name} (age: ${Math.round(messageAgeMs / 1000)}s)`);
  //             return;
  //         }
  //
  //         // Show the latest message as a speech bubble
  //         if (latestMessage.messageType.tag === "Message") {
  //             console.log(`💬 PeerManager: Showing recent message from ${peer.getPlayerData().name}`);
  //             this.chatManager.showSpeechBubble(peer, latestMessage.message);
  //         } else if (latestMessage.messageType.tag === "Command" && latestMessage.message.startsWith('/')) {
  //             // Show recent emote
  //             this.chatManager.showPeerCommand(peer, latestMessage.message);
  //         }
  //     }
  // }

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
    // Proximity updates now handled by timer instead of movement-based checks
  }

  public cleanup(): void {
    // Stop proximity update timer
    this.stopProximityUpdateTimer();

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
