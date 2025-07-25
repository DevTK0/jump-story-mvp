import { Player } from '../player';

/**
 * Service for managing death state transitions and logic
 * Extracts complex death state decision-making from DeathMonitor
 */
export class DeathStateService {
  private player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  /**
   * Determine what death state action should be taken based on HP and server state
   * @param oldHp Previous HP value
   * @param newHp Current HP value
   * @param serverState Server's reported state
   * @param currentIsDead Current local death status
   * @returns Action to take: 'die', 'respawn', 'force_dead', 'sync_dead', or 'none'
   */
  public determineStateAction(
    oldHp: number,
    newHp: number,
    serverState: string,
    currentIsDead: boolean
  ): { action: 'die' | 'respawn' | 'force_dead' | 'sync_dead' | 'none'; reason: string } {
    // Check if player just died (HP reached 0)
    if (this.hasJustDied(oldHp, newHp)) {
      return { action: 'die', reason: 'Player died! Transitioning to Dead state' };
    }

    // Check if player respawned
    if (this.hasRespawned(oldHp, newHp, serverState, currentIsDead)) {
      return { action: 'respawn', reason: 'Player respawned! Transitioning to Idle state' };
    }

    // Force Dead state if HP is 0 but client state isn't Dead yet
    if (this.shouldForceDead(newHp)) {
      return { action: 'force_dead', reason: 'Forcing Dead state - HP is 0 but state is not Dead' };
    }

    // Handle server state changes
    if (this.shouldSyncDead(serverState)) {
      return { action: 'sync_dead', reason: 'Server says player is dead, syncing state' };
    }

    return { action: 'none', reason: 'No state change needed' };
  }

  /**
   * Check if player just died (HP reached 0 from positive value)
   */
  private hasJustDied(oldHp: number, newHp: number): boolean {
    return oldHp > 0 && newHp <= 0;
  }

  /**
   * Check if player respawned
   * This handles two cases:
   * 1. HP went from 0 to positive
   * 2. Server state changed from Dead to something else while HP is positive
   */
  private hasRespawned(
    oldHp: number,
    newHp: number,
    serverState: string,
    currentIsDead: boolean
  ): boolean {
    const hpBasedRespawn = oldHp <= 0 && newHp > 0;
    const serverBasedRespawn = currentIsDead && newHp > 0 && serverState !== 'Dead';

    return hpBasedRespawn || serverBasedRespawn;
  }

  /**
   * Check if we should force Dead state
   * This happens when HP is 0 but client state isn't Dead yet
   */
  private shouldForceDead(newHp: number): boolean {
    return newHp <= 0 && !this.player.getStateMachine().isInState('Dead');
  }

  /**
   * Check if we should sync to Dead state based on server state
   * This happens when server says Dead but client isn't in Dead state
   */
  private shouldSyncDead(serverState: string): boolean {
    return serverState === 'Dead' && !this.player.getStateMachine().isInState('Dead');
  }
}
