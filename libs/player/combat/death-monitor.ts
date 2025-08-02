import { DbConnection, Player as ServerPlayer } from '@/spacetime/client';
import { Player } from '../player';
import type { System } from '@/core/types';
import { PlayerQueryService } from '../services/player-query-service';
import { DeathStateService } from './death-state-service';
import { emitSceneEvent } from '@/core/scene/scene-events';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { UIContextService } from '@/ui/services/ui-context-service';

/**
 * Monitors player health and manages death state transitions
 */
export class DeathMonitor implements System {
  private player: Player;
  private dbConnection: DbConnection | null = null;
  private playerQueryService: PlayerQueryService | null = null;
  private deathStateService: DeathStateService;
  private logger: ModuleLogger;

  // private isDead: boolean = false;

  private get isDead (): boolean {
    return !this.player.isAlive;
  }
  private set isDead (value: boolean) {
    this.player.isAlive = !value;
    if (!this.player.isAlive) {
      this.player.setPlayerState({ health: 0 });
    }
  }

  constructor(player: Player) {
    this.player = player;
    this.deathStateService = new DeathStateService(player);
    this.logger = createLogger('DeathMonitor');
  }

  public setDbConnection(connection: DbConnection): void {
    this.dbConnection = connection;
    this.playerQueryService = PlayerQueryService.getInstance();
    if (!this.playerQueryService) {
      this.logger.error('DeathMonitor: PlayerQueryService singleton not available');
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
        const isCurrentPlayerDead = this.playerQueryService.isCurrentPlayerDead();

        // If player is already dead on connection, transition to dead state
        if (isCurrentPlayerDead && !this.player.getStateMachine().isInState('Dead')) {
          // this.player.transitionToState('Dead');
          this.handlePlayerUpdate(
            this.player.getPlayerState().health,
            0,
            'Dead',
          );
        }
      }
    }
  }

  private handlePlayerUpdate(
    oldHp: number,
    newHp: number,
    serverState: string,
    newPlayer?: ServerPlayer
  ): void {
    // Player HP changed
    console.log('[DeathMonitor][handlePlayerUpdate]', { oldHp, newHp, serverState, newPlayer });

    // Use death state service to determine what action to take
    const stateAction = this.deathStateService.determineStateAction(
      oldHp,
      newHp,
      serverState,
      this.isDead
    );
    // Execute the determined action
    this.executeStateAction(stateAction.action, stateAction.reason, newPlayer);
  }

  /**
   * Execute the determined state action
   * @param action The action to take
   * @param reason Reason for the action (for logging)
   */
  private executeStateAction(
    action: 'die' | 'respawn' | 'force_dead' | 'sync_dead' | 'none',
    _reason: string,
    newPlayer?: ServerPlayer
  ): void {
    logger.info('[DeathMonitor][executeStateAction]', { action, _reason });
    switch (action) {
      case 'die':
      case 'force_dead':
      case 'sync_dead':
        // Player died - all death actions have the same effect
        this.isDead = true;
        this.player.transitionToState('Dead');
        
        // Emit death event for audio system
        emitSceneEvent(this.player.scene, 'player:died', {
          position: { x: this.player.x, y: this.player.y }
        });
        break;

      case 'respawn':
        this.respawnPlayer(newPlayer?.x, newPlayer?.y);
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

  public respawnPlayer(x?: number, y?: number) {
    // Move player to last teleport point
    if (x !== undefined && y !== undefined) {
      this.player.setPosition(x, y);
    }
    
    // Player respawned
    this.isDead = false;
    this.player.transitionToState('Idle');
    
    // Emit respawn event for audio system
    emitSceneEvent(this.player.scene, 'player:respawned', {
      position: { x: this.player.x, y: this.player.y }
    });
    
    // Play respawn effect if available
    this.playRespawnEffect();
  }

  /**
   * Play respawn visual effect
   */
  private playRespawnEffect(): void {
    try {
      this.logger.debug('Attempting to play respawn effect');
      
      // Access the scene through the player's sprite properties
      const scene = this.player.scene as any;
      
      // Check if the scene has an initializer (PlaygroundScene pattern)
      if (scene.initializer) {
        const systems = scene.initializer.getSystems();
        const respawnEffectManager = systems.managers?.getRespawnEffectManager();
        
        if (respawnEffectManager) {
          this.logger.debug('Found respawn effect manager, playing effect');
          respawnEffectManager.playRespawnEffect();
        } else {
          this.logger.warn('Respawn effect manager not found');
        }
      } else {
        this.logger.warn('Scene initializer not found');
      }
    } catch (error) {
      this.logger.warn('Failed to play respawn effect:', error);
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
