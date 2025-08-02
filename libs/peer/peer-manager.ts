import Phaser from 'phaser';
import { Peer } from './peer';
import type {
  Player as PlayerData,
  EventContext,
  DbConnection,
  PlayerMessage,
} from '@/spacetime/client';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { createLogger } from '@/core/logger';
import { buildProximityQuery, DEFAULT_PROXIMITY_CONFIGS } from '@/networking/subscription-utils';

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
  private logger = createLogger('PeerManager');

  // Proximity-based subscription configuration
  private subscriptionConfig: PeerSubscriptionConfig;
  private proximityUpdateTimer?: Phaser.Time.TimerEvent;
  private lastSubscriptionCenter: { x: number; y: number } | null = null;
  private cleanupFunctions: Array<() => void> = [];

  // Default configuration
  private static readonly DEFAULT_SUBSCRIPTION_CONFIG: PeerSubscriptionConfig = {
    useProximitySubscription: true, // Enable by default for peers
    proximityRadius: DEFAULT_PROXIMITY_CONFIGS.peers.radius,
    proximityUpdateInterval: DEFAULT_PROXIMITY_CONFIGS.peers.updateInterval,
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
    this.logger.info(`🔗 PeerManager: Setting DB connection, connection exists: ${!!connection}, db exists: ${!!connection?.db}`);
    
    if (connection?.db) {
      this.logger.info(`📊 Tables available: player=${!!connection.db.player}, playerMessage=${!!connection.db.playerMessage}`);
    }
    
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

      this.logger.info('✅ PeerManager: Proximity-based subscription active');
    } catch (error) {
      this.logger.error('❌ PeerManager: Failed to set up proximity subscription:', error);
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
    this.logger.info('🔌 PeerManager: Registering onPlayerMessageInsert handler');
    this.dbConnection.db.playerMessage.onInsert(this.onPlayerMessageInsert);
    
    // Subscribe to party membership changes
    this.logger.info('🎉 PeerManager: Registering party membership handlers');
    this.dbConnection.db.partyMember.onInsert(this.onPartyMemberChange);
    this.dbConnection.db.partyMember.onDelete(this.onPartyMemberChange);
    this.dbConnection.db.party.onUpdate(this.onPartyUpdate);
    
    // Test if we can see any messages in the table
    this.logger.info(`📊 PeerManager: Current PlayerMessage count: ${this.dbConnection.db.playerMessage.count()}`);
    
    // List all current messages for debugging
    for (const msg of this.dbConnection.db.playerMessage.iter()) {
      this.logger.info(`📧 Existing message: ${msg.playerId.toHexString()} - "${msg.message}"`);
    }

    // Store cleanup functions
    this.cleanupFunctions.push(() => {
      if (this.dbConnection?.db) {
        // Note: SpaceTimeDB SDK doesn't provide removeListener methods yet
      }
    });

    this.logger.info('✅ PeerManager: Global subscription active');
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
    
    // Subscribe to party membership changes
    this.dbConnection.db.partyMember.onInsert(this.onPartyMemberChange);
    this.dbConnection.db.partyMember.onDelete(this.onPartyMemberChange);
    this.dbConnection.db.party.onUpdate(this.onPartyUpdate);

    // Store cleanup functions
    this.cleanupFunctions.push(() => {
      if (this.dbConnection?.db) {
        // Note: SpaceTimeDB SDK doesn't provide removeListener methods yet
      }
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
      this.logger.warn(
        '⚠️ PeerManager: Cannot update proximity subscription - player position unknown'
      );
      return;
    }

    // Update the last subscription center
    this.lastSubscriptionCenter = { x: playerPosition.x, y: playerPosition.y };

    const radius = this.subscriptionConfig.proximityRadius;
    const myIdentity = this.localPlayerIdentity.toHexString();

    try {
      // Build safe proximity query excluding self
      const playerQuery = buildProximityQuery(
        'Player',
        playerPosition.x,
        playerPosition.y,
        radius,
        myIdentity
      );

      // Subscribe to players within proximity using safe query
      this.dbConnection
        .subscriptionBuilder()
        .onApplied(() => {
          this.logger.info(
            `🎯 PeerManager: Proximity subscription applied for area centered at (${playerPosition.x}, ${playerPosition.y}) with radius ${radius}px`
          );
          // Load existing peers within proximity
          this.loadProximityPeers();
        })
        .subscribe([playerQuery]);
    } catch (error) {
      this.logger.error('❌ PeerManager: Failed to update proximity subscription:', error);
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

      // Skip offline players
      if (!player.isOnline) {
        continue;
      }

      // Skip banned players
      if (player.banStatus) {
        continue;
      }

      const distance = Math.sqrt(
        Math.pow(player.x - playerPosition.x, 2) + Math.pow(player.y - playerPosition.y, 2)
      );

      const identityString = player.identity.toHexString();

      if (distance <= radius) {
        currentPeerIdentities.add(identityString);
        if (!this.peers.has(identityString)) {
          this.logger.info(
            `🎯 PeerManager: Loading nearby peer ${player.name} at distance ${Math.round(distance)}`
          );
          // Create peer manually since onPlayerInsert might not fire for existing players
          const partyName = this.getPlayerPartyName(player.identity);
          const peer = new Peer({
            scene: this.scene,
            playerData: player,
            partyName,
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
        this.logger.info(
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
    
    this.logger.info(`📬 PeerManager: Setting up proximity message subscription at (${playerPosition.x}, ${playerPosition.y}) with radius ${radius}`);

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
                     AND p.is_online = true
                     AND p.ban_status = false
                     AND pm.sent_dt >= ${cutoffTimeMicros}i64`,
      ]);

      this.logger.info(
        `📬 PeerManager: Subscribed to messages within ${radius}px radius from last 30 seconds`
      );
    } catch (error) {
      this.logger.error('❌ PeerManager: Failed to set up proximity message subscription:', error);
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
        this.logger.info(
          `📍 PeerManager: Player moved ${Math.round(distanceMoved)}px, updating proximity subscription`
        );
        this.updateProximitySubscription();
        // Update message subscription for the new position
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

    // Skip offline players
    if (!playerData.isOnline) {
      return;
    }

    // Skip banned players
    if (playerData.banStatus) {
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
          this.logger.info(
            `⚠️ PeerManager: Ignoring player ${playerData.name} - outside proximity (distance: ${Math.round(distance)}px)`
          );
          return;
        }
      }
    }

    // Create new peer
    const partyName = this.getPlayerPartyName(playerData.identity);
    const peer = new Peer({ scene: this.scene, playerData, partyName });
    this.peers.set(identityString, peer);

    // Register peer sprite with level up animation manager
    if (this.levelUpAnimationManager) {
      this.levelUpAnimationManager.registerSprite(playerData.identity, peer);
    }

    this.logger.info(`Created peer for player: ${playerData.name} (${identityString})`);

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

    // Handle offline or banned players
    if (!newPlayerData.isOnline || newPlayerData.banStatus) {
      if (peer) {
        // Player went offline or got banned - remove their peer
        const reason = !newPlayerData.isOnline ? 'went offline' : 'was banned';
        this.logger.info(
          `🚪 PeerManager: Removing peer ${newPlayerData.name} - player ${reason}`
        );

        // Clean up any chat UI elements for this peer
        if (this.chatManager) {
          this.chatManager.clearAllForEntity(peer);
        }

        peer.destroy();
        this.peers.delete(identityString);
      }
      return;
    }

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
          this.logger.info(
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
          this.logger.info(
            `👋 PeerManager: Player ${newPlayerData.name} entered proximity (distance: ${Math.round(distance)}px)`
          );

          // Create new peer
          const partyName = this.getPlayerPartyName(newPlayerData.identity);
          const newPeer = new Peer({ scene: this.scene, playerData: newPlayerData, partyName });
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
      this.logger.info(`Removed peer for player: ${playerData.name} (${identityString})`);
    }
  };

  public onPlayerMessageInsert = (_ctx: EventContext, message: PlayerMessage): void => {
    this.logger.info(`📨 PeerManager: Received PlayerMessage from ${message.playerId.toHexString()}: "${message.message}"`);
    
    // Don't handle our own messages
    if (this.localPlayerIdentity && message.playerId.isEqual(this.localPlayerIdentity)) {
      this.logger.debug(`📨 PeerManager: Ignoring own message`);
      return;
    }

    // Check if message is older than the display duration (5 seconds - default speech bubble duration)
    const messageDisplayDuration = 5000; // 5 seconds in milliseconds
    const currentTimeMicros = Date.now() * 1000; // Convert to microseconds
    const messageTimeMicros = Number(message.sentDt); // Timestamp is in microseconds
    const messageAgeMs = (currentTimeMicros - messageTimeMicros) / 1000; // Convert back to milliseconds

    if (messageAgeMs > messageDisplayDuration) {
      // Message is too old, don't display it
      this.logger.debug(
        `⏰ PeerManager: Ignoring message older than ${messageDisplayDuration / 1000}s (age: ${Math.round(messageAgeMs / 1000)}s)`
      );
      return;
    }

    // Find the peer who sent this message
    const identityString = message.playerId.toHexString();
    const peer = this.peers.get(identityString);

    this.logger.info(`📨 PeerManager: Looking for peer ${identityString}, found: ${peer ? 'yes' : 'no'}`);
    this.logger.info(`📨 PeerManager: Current peers: ${Array.from(this.peers.keys()).join(', ')}`);

    if (peer && this.chatManager) {
      // Only show regular messages as speech bubbles, not commands
      if (message.messageType.tag === 'Message') {
        this.logger.info(`💬 PeerManager: Showing speech bubble for peer ${identityString}`);
        // Show speech bubble above the peer
        this.chatManager.showSpeechBubble(peer, message.message);
      } else if (message.messageType.tag === 'Command' && message.message.startsWith('/')) {
        this.logger.info(`🎮 PeerManager: Handling command for peer ${identityString}: ${message.message}`);
        // Handle emote commands for peers
        this.handlePeerCommand(peer, message.message);
      }
    } else {
      this.logger.warn(`⚠️ PeerManager: Cannot display message - peer not found or no chat manager`);
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

  /**
   * Get a peer sprite by identity string
   * This provides encapsulated access to peer sprites without exposing the internal Map
   */
  public getPeerSprite(identityString: string): Phaser.GameObjects.Sprite | null {
    const peer = this.peers.get(identityString);
    return peer || null;
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

    // Run all cleanup functions
    for (const cleanup of this.cleanupFunctions) {
      try {
        cleanup();
      } catch (error) {
        this.logger.error('Error during cleanup:', error);
      }
    }
    this.cleanupFunctions = [];

    // Clear references
    this.dbConnection = null;
    this.localPlayerIdentity = null;
    this.levelUpAnimationManager = null;
    this.chatManager = null;
    this.lastSubscriptionCenter = null;

    this.logger.info('PeerManager: Cleaned up all resources');
  }

  /**
   * Get party name for a player
   */
  private getPlayerPartyName(playerIdentity: Identity): string {
    if (!this.dbConnection) return '';
    
    const membership = this.dbConnection.db.partyMember.playerIdentity.find(playerIdentity);
    if (!membership) return '';
    
    const party = this.dbConnection.db.party.partyId.find(membership.partyId);
    if (!party) return '';
    
    return party.partyName;
  }

  /**
   * Handle party membership changes to update peer party labels
   */
  private onPartyMemberChange = (_ctx: EventContext): void => {
    // Update all peer party labels since membership changed
    this.peers.forEach((peer) => {
      const playerData = peer.getPlayerData();
      const partyName = this.getPlayerPartyName(playerData.identity);
      peer.updatePartyLabel(partyName);
    });
  };

  /**
   * Handle party updates (name changes) to update peer party labels
   */
  private onPartyUpdate = (_ctx: EventContext): void => {
    // Update all peer party labels since party info changed
    this.peers.forEach((peer) => {
      const playerData = peer.getPlayerData();
      const partyName = this.getPlayerPartyName(playerData.identity);
      peer.updatePartyLabel(partyName);
    });
  };

  public destroy(): void {
    this.cleanup();
  }
}
