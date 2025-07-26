using SpacetimeDB;
using System;

public static partial class Module
{
    /// <summary>
    /// Service responsible for damage calculations
    /// </summary>
    public static class DamageCalculator
    {
    /// <summary>
    /// Calculate damage result based on attack type and enemy type
    /// </summary>
    public static DamageResult CalculateDamage(AttackType attackType, string enemyType)
    {
        // Base damage for each attack type
        var baseDamage = GetBaseDamageForAttack(attackType);
        
        // Check for immunities or special interactions
        var damageType = DetermineDamageType(attackType, enemyType);
        
        // Apply damage multipliers based on type
        var finalDamage = ApplyDamageMultiplier(baseDamage, damageType);
        
        return new DamageResult
        {
            type = damageType,
            baseDamage = baseDamage,
            finalDamage = finalDamage
        };
    }
    
    /// <summary>
    /// Determine damage type for player taking damage from enemy
    /// </summary>
    public static DamageType DeterminePlayerDamageType(uint playerLevel, uint enemyLevel)
    {
        var random = new Random();
        var roll = random.NextDouble();
        
        // Level difference affects damage type chances
        var levelDiff = (int)playerLevel - (int)enemyLevel;
        
        if (levelDiff >= 5)
        {
            // Player much higher level - enemy less likely to crit
            if (roll < 0.05) return DamageType.Crit; // 5% crit (enemy gets lucky)
            else return DamageType.Normal;           // 95% normal
        }
        else if (levelDiff <= -5)
        {
            // Enemy much higher level - more likely to crit
            if (roll < 0.3) return DamageType.Crit;  // 30% crit
            else return DamageType.Normal;           // 70% normal
        }
        else
        {
            // Similar levels - balanced chances
            if (roll < 0.15) return DamageType.Crit; // 15% crit
            else return DamageType.Normal;           // 85% normal
        }
    }
    
    /// <summary>
    /// Calculate damage multiplier for a given damage type
    /// </summary>
    public static float GetDamageMultiplier(DamageType damageType)
    {
        switch (damageType)
        {
            case DamageType.Crit:
                return 1.5f; // 50% more damage
            case DamageType.Weak:
                return 0.5f; // 50% less damage
            case DamageType.Strong:
                return 1.2f; // 20% more damage
            case DamageType.Normal:
            default:
                return 1.0f;
        }
    }
    
    private static float GetBaseDamageForAttack(AttackType attackType)
    {
        switch (attackType)
        {
            case AttackType.Attack1:
                return 10f;
            case AttackType.Attack2:
                return 20f;
            case AttackType.Attack3:
                return 15f;
            default:
                return 10f;
        }
    }
    
    private static DamageType DetermineDamageType(AttackType attackType, string enemyType)
    {
        // Simple implementation - always returns Normal for now
        // Will be expanded later with modifier system
        return DamageType.Normal;
    }
    
    private static float ApplyDamageMultiplier(float baseDamage, DamageType damageType)
    {
        return baseDamage * GetDamageMultiplier(damageType);
    }
    }
    
    public struct DamageResult
    {
        public DamageType type;
        public float baseDamage;
        public float finalDamage;
    }
}