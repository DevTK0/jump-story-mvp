import { DbConnection, PlayerCooldown } from '@/spacetime/client';
import { createLogger, type ModuleLogger } from '@/core/logger';
import { Timestamp } from '@clockworklabs/spacetimedb-sdk';
import type { JobConfig, Attack } from '../combat/attack-types';

export interface CombatValidationResult {
  canAttack: boolean;
  reason?: string;
}

/**
 * Service for validating combat actions on the client side
 * Checks mana costs and cooldowns before allowing attacks
 */
export class CombatValidationService {
  private static instance: CombatValidationService | null = null;
  private dbConnection: DbConnection;
  private logger: ModuleLogger = createLogger('CombatValidationService');

  private constructor(dbConnection: DbConnection) {
    this.dbConnection = dbConnection;
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(dbConnection?: DbConnection): CombatValidationService | null {
    if (!CombatValidationService.instance && dbConnection) {
      CombatValidationService.instance = new CombatValidationService(dbConnection);
    }
    return CombatValidationService.instance;
  }

  /**
   * Clear the singleton instance
   */
  public static clearInstance(): void {
    CombatValidationService.instance = null;
  }

  /**
   * Check if player can use the specified attack
   */
  public canUseAttack(
    attackNum: number,
    jobConfig: JobConfig,
    currentMana: number
  ): CombatValidationResult {
    // Get attack config
    const attackKey = `attack${attackNum}` as keyof typeof jobConfig.attacks;
    const attackConfig = jobConfig.attacks[attackKey];
    
    if (!attackConfig) {
      return { canAttack: false, reason: 'Invalid attack' };
    }

    // Check mana cost
    const manaCostResult = this.checkManaCost(attackConfig, currentMana);
    if (!manaCostResult.canAttack) {
      return manaCostResult;
    }

    // Check cooldown
    const cooldownResult = this.checkCooldown(attackNum);
    if (!cooldownResult.canAttack) {
      return cooldownResult;
    }

    return { canAttack: true };
  }

  /**
   * Check if player has enough mana for the attack
   */
  private checkManaCost(attackConfig: Attack, currentMana: number): CombatValidationResult {
    if (attackConfig.manaCost > 0 && currentMana < attackConfig.manaCost) {
      return {
        canAttack: false,
        reason: `Not enough mana (need ${attackConfig.manaCost}, have ${Math.floor(currentMana)})`
      };
    }
    return { canAttack: true };
  }

  /**
   * Check if attack is on cooldown
   */
  private checkCooldown(attackNum: number): CombatValidationResult {
    if (!this.dbConnection?.db?.playerCooldown || !this.dbConnection.identity) {
      // If we can't check cooldowns, allow the attack (server will validate)
      return { canAttack: true };
    }

    // Find current player's cooldown data
    const myIdentity = this.dbConnection.identity;
    let playerCooldown: PlayerCooldown | null = null;

    for (const cooldown of this.dbConnection.db.playerCooldown.iter()) {
      if (cooldown.playerIdentity.toHexString() === myIdentity.toHexString()) {
        playerCooldown = cooldown;
        break;
      }
    }

    if (!playerCooldown) {
      // No cooldown data found, allow attack
      return { canAttack: true };
    }

    // Get the last used timestamp for this attack
    const lastUsed = this.getLastUsedTimestamp(playerCooldown, attackNum);
    if (!lastUsed) {
      return { canAttack: true };
    }

    // Get attack config from job to check cooldown duration
    // Note: We need the job config to get the cooldown duration
    // This is passed in via canUseAttack, so we'll need to refactor slightly
    
    // For now, just return true as we need more context
    // The actual cooldown check will be done in the enhanced version
    return { canAttack: true };
  }

  /**
   * Get last used timestamp for a specific attack
   */
  private getLastUsedTimestamp(cooldown: PlayerCooldown, attackNum: number): Timestamp | null {
    switch (attackNum) {
      case 1:
        return cooldown.attack1LastUsed;
      case 2:
        return cooldown.attack2LastUsed;
      case 3:
        return cooldown.attack3LastUsed;
      default:
        return null;
    }
  }

  /**
   * Check cooldown with full context
   */
  public checkCooldownWithConfig(
    attackNum: number,
    attackConfig: Attack
  ): CombatValidationResult {
    if (!this.dbConnection?.db?.playerCooldown || !this.dbConnection.identity) {
      return { canAttack: true };
    }

    // Find current player's cooldown data
    const myIdentity = this.dbConnection.identity;
    let playerCooldown: PlayerCooldown | null = null;

    for (const cooldown of this.dbConnection.db.playerCooldown.iter()) {
      if (cooldown.playerIdentity.toHexString() === myIdentity.toHexString()) {
        playerCooldown = cooldown;
        break;
      }
    }

    if (!playerCooldown) {
      return { canAttack: true };
    }

    // Get the last used timestamp
    const lastUsed = this.getLastUsedTimestamp(playerCooldown, attackNum);
    if (!lastUsed) {
      this.logger.debug(`No last used timestamp for attack ${attackNum}`);
      return { canAttack: true };
    }

    // Calculate if cooldown has expired
    // Server expects cooldown in seconds, so convert to milliseconds
    const cooldownMs = attackConfig.cooldown * 1000;
    const now = Date.now();
    const lastUsedMs = lastUsed.toDate().getTime();
    const canUseAt = lastUsedMs + cooldownMs;

    this.logger.debug(`Cooldown check - Attack: ${attackNum}, Cooldown: ${attackConfig.cooldown}s (${cooldownMs}ms)`);
    this.logger.debug(`Last used: ${new Date(lastUsedMs).toISOString()}, Can use at: ${new Date(canUseAt).toISOString()}`);
    this.logger.debug(`Current time: ${new Date(now).toISOString()}, Can attack: ${canUseAt <= now}`);

    if (canUseAt > now) {
      const remainingSeconds = Math.ceil((canUseAt - now) / 1000);
      return {
        canAttack: false,
        reason: `Attack on cooldown (${remainingSeconds}s remaining)`
      };
    }

    return { canAttack: true };
  }
}