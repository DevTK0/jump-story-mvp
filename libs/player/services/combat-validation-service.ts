import type { DbConnection } from '@/spacetime/client';
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

  private constructor(_dbConnection: DbConnection) {
    // Note: dbConnection parameter kept for API compatibility
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
   * Note: Cooldowns are now tracked client-side in the UI
   */
  private checkCooldown(_attackNum: number): CombatValidationResult {
    // Cooldowns are now handled client-side in CombatSkillBar
    return { canAttack: true };
  }

  /**
   * Check cooldown with full context
   * Note: Cooldowns are now tracked client-side in the UI
   */
  public checkCooldownWithConfig(
    _attackNum: number,
    _attackConfig: Attack
  ): CombatValidationResult {
    // Cooldowns are now handled client-side in CombatSkillBar
    return { canAttack: true };
  }
}