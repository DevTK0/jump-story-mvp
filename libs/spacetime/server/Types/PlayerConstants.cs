using SpacetimeDB;
using System;

public static class PlayerConstants
{
    // Base player stats
    public const float BASE_HP = 100.0f;           // Base health for level 1 player
    public const float BASE_MANA = 50.0f;          // Base mana for level 1 player
    public const uint STARTING_LEVEL = 1;          // Starting level
    public const uint STARTING_EXPERIENCE = 0;    // Starting experience
    
    // Level scaling constants
    public const float HP_PER_LEVEL = 10.0f;      // Additional HP per level
    public const float MANA_PER_LEVEL = 5.0f;     // Additional mana per level
    public const uint MAX_LEVEL = 100;            // Maximum player level
    
    // Combat constants
    public const float BASE_DAMAGE = 10.0f;       // Base damage player deals
    public const float DAMAGE_PER_LEVEL = 2.0f;   // Additional damage per level
    public const float ENEMY_BASE_DAMAGE = 15.0f; // Base damage enemies deal
    public const float ENEMY_DAMAGE_PER_LEVEL = 1.5f; // Enemy damage scaling
    
    // Experience constants
    public const uint BASE_EXP_TO_LEVEL = 100;    // Experience needed for level 2
    public const float EXP_SCALING_FACTOR = 1.5f; // Exponential scaling for leveling
    
    // Recovery constants
    public const int DEATH_RESPAWN_TIME_MS = 3000; // Time before respawn (3 seconds)
    
    // Position constants
    public const float MAX_POSITION_UPDATE_DISTANCE = 200.0f; // Max pixels movement per update
    public const float SPAWN_POSITION_X = 1000.0f;  // Default spawn X coordinate
    public const float SPAWN_POSITION_Y = 100.0f;   // Default spawn Y coordinate
    
    // Scaling exponents for exponential growth
    public const double HP_SCALING_EXPONENT = 1.1;      // HP scales by 1.1^level
    public const double DAMAGE_SCALING_EXPONENT = 1.15; // Damage scales by 1.15^level
    
    // Helper methods for stat calculations
    public static float CalculateMaxHp(uint level)
    {
        return (float)Math.Floor(BASE_HP + (HP_PER_LEVEL * (level - 1)));
    }
    
    public static float CalculateMaxMana(uint level)
    {
        return (float)Math.Floor(BASE_MANA + (MANA_PER_LEVEL * (level - 1)));
    }
    
    // New exponential scaling methods using job-specific base values
    public static float CalculateMaxHpWithJob(uint level, uint baseHp)
    {
        // HP = Base HP × (1.1^level)
        return (float)Math.Floor(baseHp * Math.Pow(HP_SCALING_EXPONENT, level));
    }
    
    public static float CalculateMaxManaWithJob(uint level, uint baseMana)
    {
        // For now, mana uses the same scaling as HP
        return (float)Math.Floor(baseMana * Math.Pow(HP_SCALING_EXPONENT, level));
    }
    
    public static float CalculateScaledDamage(uint level, uint baseDamage)
    {
        // Damage = Base Damage × (1.15^level)
        return (float)Math.Floor(baseDamage * Math.Pow(DAMAGE_SCALING_EXPONENT, level));
    }
    
    public static float CalculatePlayerDamage(uint level)
    {
        return (float)Math.Floor(BASE_DAMAGE + (DAMAGE_PER_LEVEL * (level - 1)));
    }
    
    public static float CalculateEnemyDamage(uint enemyLevel, uint playerLevel)
    {
        // Enemy damage based on enemy level, with slight reduction if player level is higher
        var baseDamage = ENEMY_BASE_DAMAGE + (ENEMY_DAMAGE_PER_LEVEL * (enemyLevel - 1));
        var levelDifference = (int)playerLevel - (int)enemyLevel;
        
        // Reduce damage slightly if player is higher level (max 20% reduction)
        var damageReduction = Math.Max(0, Math.Min(0.2f, levelDifference * 0.05f));
        return (float)Math.Floor(baseDamage * (1.0f - damageReduction));
    }
    
    public static uint CalculateExperienceToNextLevel(uint currentLevel)
    {
        if (currentLevel >= MAX_LEVEL) return 0;
        return (uint)(BASE_EXP_TO_LEVEL * Math.Pow(EXP_SCALING_FACTOR, currentLevel - 1));
    }
}