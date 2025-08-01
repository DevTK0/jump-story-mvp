import { PlayerState } from '@/spacetime/client';
import { PlayerQueryService } from '@/player/services/player-query-service';

export interface StateValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Centralized service for state validation across the application.
 * Provides consistent state checks for players and enemies.
 */
export class StateValidator {
  private static instance: StateValidator;
  private playerQueryService: PlayerQueryService | null = null;

  private constructor() {
    // Try to get PlayerQueryService singleton if available
    this.playerQueryService = PlayerQueryService.getInstance();
  }

  public static getInstance(): StateValidator {
    if (!StateValidator.instance) {
      StateValidator.instance = new StateValidator();
    }
    return StateValidator.instance;
  }

  /**
   * Check if the current player is dead
   */
  public isCurrentPlayerDead(): boolean {
    if (!this.playerQueryService) {
      this.playerQueryService = PlayerQueryService.getInstance();
      if (!this.playerQueryService) {
        // If service not available, assume player is alive
        return false;
      }
    }

    return this.playerQueryService.isCurrentPlayerDead();
  }

  /**
   * Check if a player can perform an action based on their state
   */
  public canPlayerPerformAction(
    action: 'attack' | 'move' | 'jump' | 'respawn' | 'climb'
  ): StateValidationResult {
    logger.info('[StateValidator][canPlayerPerformAction] Action', action);
    const isDead = this.isCurrentPlayerDead();

    if (isDead) {
      if (action === 'respawn') {
        return { isValid: true };
      }
      return {
        isValid: false,
        reason: 'Player is dead and cannot perform this action',
      };
    }

    // Alive players can't respawn
    if (action === 'respawn') {
      logger.info('[StateValidator][canPlayerPerformAction] Unable to respawn');
      return {
        isValid: false,
        reason: 'Player must be dead to respawn',
      };
    }

    // Check specific action constraints
    const player = this.playerQueryService?.findCurrentPlayer();
    if (!player) {
      return { isValid: true }; // Assume valid if we can't check
    }

    switch (action) {
      case 'attack':
        // Can't attack while climbing or in certain states
        if (player.state.tag === 'Climbing') {
          return {
            isValid: false,
            reason: 'Cannot attack while climbing',
          };
        }
        break;

      case 'jump':
        // Can't jump while attacking or climbing
        if (this.isAttackState(player.state) || player.state.tag === 'Climbing') {
          return {
            isValid: false,
            reason: 'Cannot jump in current state',
          };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Check if a player state is an attack state
   */
  public isAttackState(state: PlayerState): boolean {
    return state.tag === 'Attack1' || state.tag === 'Attack2' || state.tag === 'Attack3';
  }

  /**
   * Check if a player state is a movement state
   */
  public isMovementState(state: PlayerState): boolean {
    return state.tag === 'Idle' || state.tag === 'Walk';
  }

  /**
   * Validate a state transition
   */
  public canTransitionState(from: PlayerState, to: PlayerState): StateValidationResult {
    // Dead players can only transition to Dead or Idle (after respawn)
    if (from.tag === 'Dead' && to.tag !== 'Dead' && to.tag !== 'Idle') {
      return {
        isValid: false,
        reason: 'Dead players can only respawn to Idle state',
      };
    }

    // Attack states can only transition to Idle
    if (this.isAttackState(from) && to.tag !== 'Idle') {
      return {
        isValid: false,
        reason: 'Attack states must transition to Idle',
      };
    }

    // Can't transition to Dead unless actually dead (HP check would be done elsewhere)
    if (to.tag === 'Dead' && from.tag !== 'Dead') {
      // This would be validated with HP check in actual usage
      return { isValid: true };
    }

    return { isValid: true };
  }

  /**
   * Check if an enemy is in a valid state to damage the player
   */
  public canEnemyDamagePlayer(enemyHp: number, enemyState?: PlayerState): boolean {
    // Dead enemies can't damage
    if (enemyHp <= 0) return false;
    if (enemyState && enemyState.tag === 'Dead') return false;

    return true;
  }

  /**
   * Check if an enemy can take damage
   */
  public canEnemyTakeDamage(enemyHp: number, enemyState?: PlayerState): boolean {
    // Already dead enemies can't take more damage
    if (enemyHp <= 0) return false;
    if (enemyState && enemyState.tag === 'Dead') return false;

    return true;
  }

  /**
   * Validate player health and state consistency
   */
  public validateHealthStateConsistency(hp: number, state: PlayerState): StateValidationResult {
    if (hp <= 0 && state.tag !== 'Dead') {
      return {
        isValid: false,
        reason: 'Player with 0 HP must be in Dead state',
      };
    }

    if (hp > 0 && state.tag === 'Dead') {
      return {
        isValid: false,
        reason: 'Player with positive HP cannot be in Dead state',
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const stateValidator = StateValidator.getInstance();
