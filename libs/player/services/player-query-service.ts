import { DbConnection, Player } from '@/spacetime/client';

// Player query specific error types
export class PlayerQueryError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PlayerQueryError';
  }
}

/**
 * Service for querying player data from SpacetimeDB
 * Uses targeted subscription to minimize bandwidth and memory usage
 *
 * This is a singleton service that should be shared across all components
 * to avoid duplicate subscriptions and ensure consistent state.
 */
export class PlayerQueryService {
  private static instance: PlayerQueryService | null = null;
  private dbConnection: DbConnection;
  private currentPlayerData: Player | null = null;
  private isTargetedSubscriptionActive = false;

  private constructor(dbConnection: DbConnection) {
    this.dbConnection = dbConnection;
    this.setupTargetedSubscription();
  }

  /**
   * Get or create the singleton instance of PlayerQueryService
   * @param dbConnection Required on first call to create the instance
   * @returns The singleton instance or null if no connection provided on first call
   */
  public static getInstance(dbConnection?: DbConnection): PlayerQueryService | null {
    if (!PlayerQueryService.instance && dbConnection) {
      PlayerQueryService.instance = new PlayerQueryService(dbConnection);
    }
    return PlayerQueryService.instance;
  }

  /**
   * Clear the singleton instance (useful for cleanup/testing)
   */
  public static clearInstance(): void {
    PlayerQueryService.instance = null;
  }

  /**
   * Set up a targeted subscription for just the current player
   * This minimizes bandwidth and memory usage by only subscribing to relevant data
   */
  private async setupTargetedSubscription(): Promise<void> {
    if (!this.dbConnection.identity || this.isTargetedSubscriptionActive) {
      return;
    }

    try {
      const myIdentity = this.dbConnection.identity.toHexString();

      // Subscribe only to the current player's row using SQL query
      // This follows the pattern: SELECT * FROM Player WHERE identity = 'myIdentity'
      this.dbConnection
        .subscriptionBuilder()
        .onApplied(() => {
          console.log('Player-specific subscription applied');
          this.updateCurrentPlayerFromSubscription();
        })
        .subscribe([`SELECT * FROM Player WHERE identity = x'${myIdentity}'`]);

      this.isTargetedSubscriptionActive = true;
      console.log('Subscribed to targeted player data');

      // Set up event listeners for the targeted data
      this.setupTargetedEventListeners();
    } catch (error) {
      const queryError = new PlayerQueryError('Failed to set up targeted player subscription', {
        identity: this.dbConnection.identity?.toHexString(),
        originalError: error,
      });
      console.error('Player subscription error:', queryError.message, queryError.context, error);
      // Fallback to the old inefficient approach if targeted subscription fails
      this.setupFallbackEventListeners();
    }
  }

  /**
   * Set up event listeners for targeted subscription
   * Even with targeted subscription, we should verify identity to be safe
   */
  private setupTargetedEventListeners(): void {
    if (!this.dbConnection?.db?.player || !this.dbConnection.identity) {
      return;
    }

    const myIdentityHex = this.dbConnection.identity.toHexString();

    // Verify identity even with targeted subscription for safety
    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      if (newPlayer.identity.toHexString() === myIdentityHex) {
        // Current player updated via targeted subscription
        this.currentPlayerData = newPlayer;
      }
    });

    this.dbConnection.db.player.onInsert((_ctx, insertedPlayer) => {
      if (insertedPlayer.identity.toHexString() === myIdentityHex) {
        // Current player inserted via targeted subscription
        this.currentPlayerData = insertedPlayer;
      }
    });

    this.dbConnection.db.player.onDelete((_ctx, deletedPlayer) => {
      if (deletedPlayer.identity.toHexString() === myIdentityHex) {
        // Current player deleted via targeted subscription
        this.currentPlayerData = null;
      }
    });
  }

  /**
   * Fallback event listeners that filter by identity (less efficient)
   * Used only if targeted subscription setup fails
   */
  private setupFallbackEventListeners(): void {
    if (!this.dbConnection?.db?.player) {
      return;
    }

    // Using fallback event listeners - less efficient than targeted subscription

    this.dbConnection.db.player.onUpdate((_ctx, _oldPlayer, newPlayer) => {
      if (
        this.dbConnection.identity &&
        newPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()
      ) {
        this.currentPlayerData = newPlayer;
      }
    });

    this.dbConnection.db.player.onInsert((_ctx, insertedPlayer) => {
      if (
        this.dbConnection.identity &&
        insertedPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()
      ) {
        this.currentPlayerData = insertedPlayer;
      }
    });

    this.dbConnection.db.player.onDelete((_ctx, deletedPlayer) => {
      if (
        this.dbConnection.identity &&
        deletedPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()
      ) {
        this.currentPlayerData = null;
      }
    });
  }

  /**
   * Update current player data from the targeted subscription
   */
  private updateCurrentPlayerFromSubscription(): void {
    if (!this.dbConnection?.db?.player || !this.dbConnection.identity) {
      return;
    }

    const myIdentityHex = this.dbConnection.identity.toHexString();

    // Verify identity even with targeted subscription
    for (const player of this.dbConnection.db.player.iter()) {
      if (player.identity.toHexString() === myIdentityHex) {
        this.currentPlayerData = player;
        // Loaded current player from targeted subscription
        break;
      }
    }
  }

  /**
   * Find the current player's data from the server
   * Uses targeted subscription data for maximum efficiency
   * @returns Server player data or null if not found
   */
  public findCurrentPlayer(): Player | null {
    if (!this.dbConnection.identity) {
      return null;
    }

    // If we have targeted subscription, return cached data directly
    if (this.isTargetedSubscriptionActive) {
      return this.currentPlayerData;
    }

    // Fallback: search through all players (only if targeted subscription failed)
    if (!this.dbConnection?.db?.player) {
      return null;
    }

    const myIdentityHex = this.dbConnection.identity.toHexString();
    for (const serverPlayer of this.dbConnection.db.player.iter()) {
      if (serverPlayer.identity.toHexString() === myIdentityHex) {
        return serverPlayer;
      }
    }

    return null;
  }

  /**
   * Check if the current player is dead based on server state
   * @returns true if player is dead (HP <= 0 or state is 'Dead')
   */
  public isCurrentPlayerDead(): boolean {
    const player = this.findCurrentPlayer();
    if (!player) return false;

    return player.currentHp <= 0 || player.state.tag === 'Dead';
  }

  /**
   * Get current player's HP from server
   * @returns Current HP or null if player not found
   */
  public getCurrentPlayerHp(): number | null {
    const player = this.findCurrentPlayer();
    return player ? player.currentHp : null;
  }

  /**
   * Get current player's state from server
   * @returns Player state tag or null if player not found
   */
  public getCurrentPlayerState(): string | null {
    const player = this.findCurrentPlayer();
    return player ? player.state.tag : null;
  }

  /**
   * Get current player's position from server
   * @returns Position object {x, y} or null if player not found
   */
  public getCurrentPlayerPosition(): { x: number; y: number } | null {
    const player = this.findCurrentPlayer();
    return player ? { x: player.x, y: player.y } : null;
  }
}
