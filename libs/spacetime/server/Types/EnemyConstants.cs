using SpacetimeDB;
using System;

public static class EnemyConstants
{
    // Movement constants
    public const float PATROL_SPEED = 50.0f; // Movement speed in pixels per second
    public const float DELTA_TIME = 0.1f; // Timer runs every 100ms
    
    // Aggro and combat constants
    public const float AGGRO_RANGE = 150.0f; // Distance to detect players
    public const float LEASH_DISTANCE = 800.0f; // Max distance from spawn area to maintain aggro (screen's worth)
    public const float KNOCKBACK_DISTANCE = 30.0f; // Pixels to knock back enemy when attacked
    public const int STEP_BACK_MULTIPLIER = 3; // Step back 3x the normal movement when blocked
    
    // Recovery and timing constants
    public const int RECOVERY_TIME_MS = 500; // Time in milliseconds for enemy to recover from damaged state
    public const int ATTACK_RECOVERY_TIME_MS = 1500; // Time in milliseconds for boss to recover from attack state
    public const int CLEANUP_DELAY_SECONDS = 5; // Time to wait before cleaning up dead bodies
    public const float ENEMY_MAX_HP = 100.0f; // Base health for all enemies
    
    // Spawn constants  
    public const uint DEFAULT_SPAWN_INTERVAL = 60; // Default spawn interval in seconds
    
    // Movement precision
    public const float MOVEMENT_EPSILON = 0.1f; // Minimum movement threshold to detect position changes
    public const float POSITION_EPSILON = 0.01f; // Minimum position change to trigger database update
    
    // Helper methods for time calculations
    public static TimeSpan GetRecoveryTimeSpan() => TimeSpan.FromMilliseconds(RECOVERY_TIME_MS);
    public static TimeSpan GetAttackRecoveryTimeSpan() => TimeSpan.FromMilliseconds(ATTACK_RECOVERY_TIME_MS);
    public static TimeSpan GetCleanupTimeSpan() => TimeSpan.FromSeconds(CLEANUP_DELAY_SECONDS);
}