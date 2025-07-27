using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Text.Json;

public static partial class Module
{
    [Reducer]
    public static void PopulateEnemyConfig(ReducerContext ctx, string adminApiKey, string enemyConfigJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to populate enemy config from {ctx.Sender}");
            return;
        }

        Log.Info("Populating EnemyConfig table from JSON data...");
        
        try
        {
            // Clear existing enemy configs
            var existingConfigs = new List<string>();
            foreach (var config in ctx.Db.EnemyConfig.Iter())
            {
                existingConfigs.Add(config.enemy_type);
            }
            
            foreach (var enemyType in existingConfigs)
            {
                ctx.Db.EnemyConfig.enemy_type.Delete(enemyType);
            }
            
            Log.Info($"Cleared {existingConfigs.Count} existing enemy configs");
            
            // Parse the JSON
            var jsonDoc = JsonDocument.Parse(enemyConfigJson);
            var enemies = jsonDoc.RootElement.GetProperty("enemies");
            
            int configCount = 0;
            foreach (var enemyProperty in enemies.EnumerateObject())
            {
                var enemyType = enemyProperty.Name;
                var enemyData = enemyProperty.Value;
                
                // Extract properties with defaults
                var health = enemyData.TryGetProperty("health", out var healthProp) ? healthProp.GetUInt32() : 100u;
                var level = enemyData.TryGetProperty("level", out var levelProp) ? levelProp.GetUInt32() : 1u;
                var baseExpReward = enemyData.TryGetProperty("base_exp_reward", out var expProp) ? expProp.GetUInt32() : 25u;
                var movementSpeed = enemyData.TryGetProperty("movement_speed", out var speedProp) ? speedProp.GetUInt32() : 50u;
                var damage = enemyData.TryGetProperty("damage", out var damageProp) ? damageProp.GetUInt32() : 10u;
                var attackRange = enemyData.TryGetProperty("attack_range", out var attackRangeProp) ? attackRangeProp.GetUInt32() : 50u;
                var aggroRange = enemyData.TryGetProperty("aggro_range", out var aggroRangeProp) ? aggroRangeProp.GetUInt32() : 150u;
                var behavior = enemyData.TryGetProperty("ai_behavior", out var behaviorProp) ? behaviorProp.GetString() ?? "patrol" : "patrol";
                
                // Insert the enemy config
                ctx.Db.EnemyConfig.Insert(new EnemyConfig
                {
                    enemy_type = enemyType,
                    max_hp = health,
                    level = level,
                    behavior = behavior,
                    base_exp_reward = baseExpReward,
                    movement_speed = movementSpeed,
                    damage = damage,
                    attack_range = attackRange,
                    aggro_range = aggroRange
                });
                
                configCount++;
                Log.Info($"Added config for {enemyType}: Level {level}, HP {health}, EXP {baseExpReward}");
            }
            
            Log.Info($"✅ Successfully populated {configCount} enemy configurations");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to populate enemy config: {ex.Message}");
        }
    }

    [Reducer]
    public static void PopulatePlayerLevel(ReducerContext ctx, string adminApiKey, string levelingCurveJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to populate player leveling config from {ctx.Sender}");
            return;
        }

        Log.Info("Populating PlayerLevel table from JSON data...");
        
        try
        {
            // Clear existing leveling data
            var existingLevels = new List<uint>();
            foreach (var level in ctx.Db.PlayerLevel.Iter())
            {
                existingLevels.Add(level.level);
            }
            
            foreach (var level in existingLevels)
            {
                ctx.Db.PlayerLevel.level.Delete(level);
            }
            
            Log.Info($"Cleared {existingLevels.Count} existing leveling entries");
            
            // Parse the JSON
            var jsonDoc = JsonDocument.Parse(levelingCurveJson);
            var levels = jsonDoc.RootElement.GetProperty("levels");
            
            int levelCount = 0;
            foreach (var levelEntry in levels.EnumerateArray())
            {
                var level = levelEntry.GetProperty("level").GetUInt32();
                var expRequired = levelEntry.GetProperty("exp_required").GetUInt32();
                
                // Insert the leveling data
                ctx.Db.PlayerLevel.Insert(new PlayerLevel
                {
                    level = level,
                    exp_required = expRequired
                });
                
                levelCount++;
                Log.Info($"Added leveling data for level {level}: {expRequired} EXP required");
            }
            
            Log.Info($"✅ Successfully populated {levelCount} player leveling entries");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to populate player leveling: {ex.Message}");
        }
    }
}