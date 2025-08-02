using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Text.Json;

public static partial class Module
{

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

    [Reducer]
    public static void PopulateEnemy(ReducerContext ctx, string adminApiKey, string enemyConfigJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to populate enemy table from {ctx.Sender}");
            return;
        }

        Log.Info("Populating Enemy table from JSON data...");
        
        try
        {
            // Clear existing enemy data
            var existingEnemies = new List<string>();
            foreach (var enemy in ctx.Db.Enemy.Iter())
            {
                existingEnemies.Add(enemy.name);
            }
            
            foreach (var enemyName in existingEnemies)
            {
                ctx.Db.Enemy.name.Delete(enemyName);
            }
            
            Log.Info($"Cleared {existingEnemies.Count} existing enemy entries");
            
            // Parse the JSON
            var jsonDoc = JsonDocument.Parse(enemyConfigJson);
            var enemies = jsonDoc.RootElement.GetProperty("enemies");
            
            int enemyCount = 0;
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
                var invulnerable = enemyData.TryGetProperty("invulnerable", out var invulnerableProp) ? invulnerableProp.GetBoolean() : false;
                
                // Map string behavior to enum
                AiBehavior aiBehavior = behavior.ToLower() switch
                {
                    "aggressive" => AiBehavior.Aggressive,
                    _ => AiBehavior.Patrol
                };
                
                // Insert the enemy
                ctx.Db.Enemy.Insert(new Enemy
                {
                    name = enemyType,
                    health = (float)health,
                    level = level,
                    ai_behavior = aiBehavior,
                    exp_reward = baseExpReward,
                    move_speed = (float)movementSpeed,
                    damage = (float)damage,
                    attack_range = (float)attackRange,
                    aggro_range = (float)aggroRange,
                    invulnerable = invulnerable
                });
                
                enemyCount++;
                Log.Info($"Added enemy {enemyType}: Level {level}, HP {health}, EXP {baseExpReward}");
            }
            
            Log.Info($"✅ Successfully populated {enemyCount} enemy definitions");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to populate enemy table: {ex.Message}");
        }
    }

    [Reducer]
    public static void InitializeTeleports(ReducerContext ctx, string adminApiKey, string teleportJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to initialize teleports from {ctx.Sender}");
            return;
        }

        Log.Info("Initializing Teleport table from JSON data...");
        
        try
        {
            // Clear existing teleport data
            var existingTeleports = new List<string>();
            foreach (var teleport in ctx.Db.Teleport.Iter())
            {
                existingTeleports.Add(teleport.location_name);
            }
            
            foreach (var locationName in existingTeleports)
            {
                ctx.Db.Teleport.location_name.Delete(locationName);
            }
            
            if (existingTeleports.Count > 0)
            {
                Log.Info($"Cleared {existingTeleports.Count} existing teleport locations");
            }
            
            // Parse JSON data
            var jsonDoc = JsonDocument.Parse(teleportJson);
            var teleportArray = jsonDoc.RootElement.EnumerateArray();
            
            int teleportCount = 0;
            foreach (var teleportElement in teleportArray)
            {
                var name = teleportElement.GetProperty("name").GetString();
                var x = (float)teleportElement.GetProperty("x").GetDouble();
                var y = (float)teleportElement.GetProperty("y").GetDouble();
                
                if (name == null)
                {
                    Log.Warn("Skipping teleport location with null name");
                    continue;
                }
                
                // Insert the teleport location
                ctx.Db.Teleport.Insert(new Teleport
                {
                    location_name = name,
                    x = x,
                    y = y
                });
                
                teleportCount++;
                Log.Info($"Added teleport location '{name}' at ({x}, {y})");
            }
            
            Log.Info($"✅ Successfully initialized {teleportCount} teleport locations");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to initialize teleports: {ex.Message}");
        }
    }

}