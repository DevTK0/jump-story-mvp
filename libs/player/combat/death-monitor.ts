import { DbConnection, Player as ServerPlayer } from '@/spacetime/client';
import { Player } from '../player';
import type { System } from '@/core/types';
import { PlayerQueryService } from '../services/player-query-service';
import { DeathStateService } from './death-state-service';

/**
 * Monitors player health and manages death state transitions
 */
export class DeathMonitor implements System {
  private player: Player;
  private dbConnection: DbConnection | null = null;
  private isDead: boolean = false;
  private playerQueryService: PlayerQueryService | null = null;
  private deathStateService: DeathStateService;

  constructor(player: Player) {
    this.player = player;
    this.deathStateService = new DeathStateService(player);
  }

  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    this.playerQueryService = PlayerQueryService.getInstance();
    if (!this.playerQueryService) {
      console.error('❌ DeathMonitor: PlayerQueryService singleton not available');
      return;
    }

    // Subscribe to player updates
    if (this.dbConnection.db && this.dbConnection.db.player) {
      this.dbConnection.db.player.onUpdate((_ctx, oldPlayer, newPlayer) => {
        // Only process updates for the current player
        if (
          this.dbConnection &&
          this.dbConnection.identity &&
          newPlayer.identity.toHexString() === this.dbConnection.identity.toHexString()
        ) {
          this.handlePlayerUpdate(
            oldPlayer?.currentHp || 100,
            newPlayer.currentHp,
            newPlayer.state.tag,
            newPlayer
          );
        }
      });

      // Check initial state using PlayerQueryService
      if (this.playerQueryService) {
        this.isDead = this.playerQueryService.isCurrentPlayerDead();

        // If player is already dead on connection, transition to dead state
        if (this.isDead && !this.player.getStateMachine().isInState('Dead')) {
          this.player.transitionToState('Dead');
        }
      }
    }
  }

  private handlePlayerUpdate(
    oldHp: number,
    newHp: number,
    serverState: string,
    _newPlayer: ServerPlayer
  ): void {
    // Player HP changed

    // Use death state service to determine what action to take
    const stateAction = this.deathStateService.determineStateAction(
      oldHp,
      newHp,
      serverState,
      this.isDead
    );

    // Execute the determined action
    this.executeStateAction(stateAction.action, stateAction.reason);
  }

  /**
   * Execute the determined state action
   * @param action The action to take
   * @param reason Reason for the action (for logging)
   */
  private executeStateAction(
    action: 'die' | 'respawn' | 'force_dead' | 'sync_dead' | 'none',
    _reason: string
  ): void {
    switch (action) {
      case 'die':
      case 'force_dead':
      case 'sync_dead':
        // Player died - all death actions have the same effect
        this.isDead = true;
        this.player.transitionToState('Dead');
        break;

      case 'respawn':
        // Player respawned
        this.isDead = false;
        this.player.transitionToState('Idle');
        
        // Play respawn effect if available
        this.playRespawnEffect();
        break;

      case 'none':
        // No action needed
        break;

      default:
        // Unknown death state action
        break;
    }
  }

  public isPlayerDead(): boolean {
    return this.isDead;
  }

  /**
   * Play respawn visual effect
   */
  private playRespawnEffect(): void {
    try {
      console.log('[DeathMonitor] Attempting to play respawn effect');
      
      // Access the scene through the player's sprite properties
      const scene = this.player.scene as any;
      
      // Check if the scene has an initializer (PlaygroundScene pattern)
      if (scene.initializer) {
        const systems = scene.initializer.getSystems();
        const respawnEffectManager = systems.managers?.getRespawnEffectManager();
        
        if (respawnEffectManager) {
          console.log('[DeathMonitor] Found respawn effect manager, playing effect');
          respawnEffectManager.playRespawnEffect();
        } else {
          console.warn('[DeathMonitor] Respawn effect manager not found');
        }
      } else {
        console.warn('[DeathMonitor] Scene initializer not found');
      }
    } catch (error) {
      console.warn('[DeathMonitor] Failed to play respawn effect:', error);
    }
  }

  /**
   * Update method required by System interface
   * DeathMonitor is event-driven, so this is empty
   */
  public update(_time: number, _delta: number): void {
    // DeathMonitor works through SpacetimeDB subscriptions
    // No per-frame updates needed
  }

  /**
   * Cleanup method
   */
  public destroy(): void {
    // Subscriptions are cleaned up automatically when connection closes
  }
}
