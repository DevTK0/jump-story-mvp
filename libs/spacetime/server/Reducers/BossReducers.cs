using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

public static partial class Module
{
    [Reducer]
    public static void PopulateBossTriggers(ReducerContext ctx, string adminApiKey, string enemyConfigJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to populate boss triggers from {ctx.Sender}");
            return;
        }

        // Clear existing triggers first
        var triggersToRemove = new List<string>();
        foreach (var trigger in ctx.Db.BossTrigger.Iter())
        {
            triggersToRemove.Add(trigger.enemy_type);
        }
        foreach (var enemyType in triggersToRemove)
        {
            ctx.Db.BossTrigger.enemy_type.Delete(enemyType);
        }

        // Parse the JSON configuration
        try
        {
            var jsonDoc = JsonDocument.Parse(enemyConfigJson);
            var enemies = jsonDoc.RootElement.GetProperty("enemies");
            
            int count = 0;
            foreach (var enemyProperty in enemies.EnumerateObject())
            {
                var enemyType = enemyProperty.Name;
                var enemyData = enemyProperty.Value;
                
                // Check if this enemy has a boss trigger
                if (enemyData.TryGetProperty("boss_trigger", out var bossTriggerProp))
                {
                    var bossToSpawn = bossTriggerProp.GetProperty("boss_to_spawn").GetString();
                    var requiredKills = bossTriggerProp.GetProperty("required_kills").GetUInt32();
                    
                    if (!string.IsNullOrEmpty(bossToSpawn))
                    {
                        var trigger = new BossTrigger
                        {
                            enemy_type = enemyType,
                            boss_to_spawn = bossToSpawn,
                            current_kills = 0,
                            required_kills = requiredKills,
                            active = true
                        };
                        
                        ctx.Db.BossTrigger.Insert(trigger);
                        count++;
                        Log.Info($"Added boss trigger: Kill {requiredKills} {enemyType} -> Spawn {bossToSpawn}");
                    }
                }
            }
            
            Log.Info($"Successfully populated {count} boss triggers from config");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to populate boss triggers: {ex.Message}");
        }
    }

    [Reducer]
    public static void PopulateBoss(ReducerContext ctx, string adminApiKey, string bossConfigJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to populate bosses from {ctx.Sender}");
            return;
        }

        // Clear existing bosses and their attacks first
        var bossesToRemove = new List<string>();
        foreach (var boss in ctx.Db.Boss.Iter())
        {
            bossesToRemove.Add(boss.boss_id);
        }
        
        // Clear all boss attacks
        var attacksToRemove = new List<uint>();
        foreach (var attack in ctx.Db.BossAttack.Iter())
        {
            attacksToRemove.Add(attack.attack_id);
        }
        foreach (var attackId in attacksToRemove)
        {
            ctx.Db.BossAttack.attack_id.Delete(attackId);
        }
        
        foreach (var id in bossesToRemove)
        {
            ctx.Db.Boss.boss_id.Delete(id);
        }

        // Parse the JSON configuration
        try
        {
            var jsonDoc = JsonDocument.Parse(bossConfigJson);
            var bosses = jsonDoc.RootElement.GetProperty("bosses");
            
            int count = 0;
            foreach (var bossProperty in bosses.EnumerateObject())
            {
                var bossId = bossProperty.Name;
                var bossData = bossProperty.Value;
                
                // Extract properties
                var health = bossData.GetProperty("health").GetSingle();
                var moveSpeed = bossData.GetProperty("move_speed").GetSingle();
                var damage = bossData.GetProperty("damage").GetSingle();
                var sprite = bossData.GetProperty("sprite").GetString() ?? bossId;
                var name = bossData.GetProperty("name").GetString() ?? bossId;
                var aiBehaviorStr = bossData.GetProperty("ai_behavior").GetString() ?? "patrol";
                var attackRange = bossData.GetProperty("attack_range").GetSingle();
                var aggroRange = bossData.GetProperty("aggro_range").GetSingle();
                var level = bossData.GetProperty("level").GetUInt32();
                var expReward = bossData.GetProperty("exp_reward").GetUInt32();
                
                // Map string behavior to enum
                AiBehavior aiBehavior = aiBehaviorStr.ToLower() switch
                {
                    "aggressive" => AiBehavior.Aggressive,
                    _ => AiBehavior.Patrol
                };

                var boss = new Boss
                {
                    boss_id = bossId,
                    display_name = name,
                    base_health = health,
                    base_damage = damage,
                    level = level,
                    exp_reward = expReward,
                    move_speed = moveSpeed,
                    ai_behavior = aiBehavior,
                    attack_range = attackRange,
                    aggro_range = aggroRange
                };

                ctx.Db.Boss.Insert(boss);
                count++;
                Log.Info($"Added boss: {bossId} - {name} (Level {level})");
                
                // Check if this boss has attacks defined
                if (bossData.TryGetProperty("attacks", out var attacksProp))
                {
                    // Parse attack1
                    if (attacksProp.TryGetProperty("attack1", out var attack1))
                    {
                        InsertBossAttack(ctx, bossId, 1, attack1);
                    }
                    
                    // Parse attack2
                    if (attacksProp.TryGetProperty("attack2", out var attack2))
                    {
                        InsertBossAttack(ctx, bossId, 2, attack2);
                    }
                    
                    // Parse attack3
                    if (attacksProp.TryGetProperty("attack3", out var attack3))
                    {
                        InsertBossAttack(ctx, bossId, 3, attack3);
                    }
                }
            }

            Log.Info($"Successfully populated {count} boss configurations");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to populate bosses: {ex.Message}");
        }
    }

    [Reducer]
    public static void InitializeBossRoutes(ReducerContext ctx, string adminApiKey, string tilemapJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to initialize boss routes from {ctx.Sender}");
            return;
        }

        // Clear existing routes first
        var routesToRemove = new List<uint>();
        foreach (var route in ctx.Db.BossRoute.Iter())
        {
            routesToRemove.Add(route.route_id);
        }
        foreach (var id in routesToRemove)
        {
            ctx.Db.BossRoute.route_id.Delete(id);
        }

        // Parse tilemap JSON
        try
        {
            using var doc = JsonDocument.Parse(tilemapJson);
            var layers = doc.RootElement.GetProperty("layers");
            
            int routeCount = 0;
            
            // Find boss spawns in the Bosses layer
            foreach (var layer in layers.EnumerateArray())
            {
                if (layer.GetProperty("name").GetString() == "Bosses")
                {
                    var objects = layer.GetProperty("objects");
                    foreach (var obj in objects.EnumerateArray())
                    {
                        var properties = obj.GetProperty("properties");
                        string bossType = "";
                        bool isBoss = false;

                        foreach (var prop in properties.EnumerateArray())
                        {
                            string propName = prop.GetProperty("name").GetString() ?? "";
                            string propValue = prop.GetProperty("value").GetString() ?? "";

                            if (propName == "enemy")
                            {
                                bossType = propValue;
                            }
                            else if (propName == "type" && propValue == "boss")
                            {
                                isBoss = true;
                            }
                        }

                        if (isBoss && !string.IsNullOrEmpty(bossType))
                        {
                            var x = obj.GetProperty("x").GetSingle();
                            var y = obj.GetProperty("y").GetSingle();
                            var width = obj.GetProperty("width").GetSingle();
                            var height = obj.GetProperty("height").GetSingle();

                            var bossRoute = new BossRoute
                            {
                                boss_id = bossType,
                                spawn_area = new DbRect(
                                    new DbVector2(x, y),
                                    new DbVector2(width, height)
                                )
                            };

                            ctx.Db.BossRoute.Insert(bossRoute);
                            routeCount++;
                            Log.Info($"Added boss route for {bossType} at ({x}, {y}) with area {width}x{height}");
                        }
                    }
                    break;
                }
            }

            Log.Info($"Initialized {routeCount} boss routes from tilemap");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to initialize boss routes: {ex.Message}");
        }
    }

    [Reducer]
    public static void SpawnBoss(ReducerContext ctx, string adminApiKey, string bossId, float x, float y)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to spawn boss from {ctx.Sender}");
            return;
        }

        // Get boss data
        var boss = ctx.Db.Boss.boss_id.Find(bossId);
        if (boss == null)
        {
            Log.Error($"Boss type '{bossId}' not found");
            return;
        }

        // Find a route for this boss (for tracking purposes)
        BossRoute? route = null;
        foreach (var r in ctx.Db.BossRoute.Iter())
        {
            if (r.boss_id == bossId)
            {
                route = r;
                break;
            }
        }

        if (route == null)
        {
            Log.Warn($"No route found for boss '{bossId}', creating temporary route");
            // Create a temporary route
            var tempRoute = new BossRoute
            {
                boss_id = bossId,
                spawn_area = new DbRect(
                    new DbVector2(x - 50, y - 50),
                    new DbVector2(100, 100)
                )
            };
            ctx.Db.BossRoute.Insert(tempRoute);
            route = tempRoute;
        }

        // Create boss spawn using unified Spawn table
        var bossSpawn = new Spawn
        {
            route_id = route.Value.route_id,
            enemy = bossId, // Boss ID goes in enemy field
            x = x,
            y = y,
            state = PlayerState.Idle,
            facing = FacingDirection.Right,
            current_hp = boss.Value.base_health,
            max_hp = boss.Value.base_health,
            level = boss.Value.level,
            last_updated = ctx.Timestamp,
            moving_right = true,
            aggro_target = null,
            spawn_time = ctx.Timestamp,
            enemy_type = EnemyType.Boss
        };

        ctx.Db.Spawn.Insert(bossSpawn);
        Log.Info($"Spawned boss '{boss.Value.display_name}' at ({x}, {y})");

        // Send standardized spawn announcement
        var announcement = new Broadcast
        {
            message = $"{boss.Value.display_name} has appeared!",
            publish_dt = ctx.Timestamp
        };
        ctx.Db.Broadcast.Insert(announcement);
    }

    // DamageBoss reducer removed - now handled by unified DamageEnemy reducer which supports both enemies and bosses

    private static void InsertBossAttack(ReducerContext ctx, string bossId, byte attackSlot, JsonElement attackData)
    {
        try
        {
            var attackType = attackData.GetProperty("attackType").GetString() ?? "directional";
            var damage = attackData.GetProperty("damage").GetSingle();
            var cooldown = attackData.GetProperty("cooldown").GetSingle();
            var knockback = attackData.GetProperty("knockback").GetUInt32();
            var range = attackData.GetProperty("range").GetSingle();
            var hits = (byte)attackData.GetProperty("hits").GetInt32();
            
            string? projectile = null;
            if (attackData.TryGetProperty("projectile", out var projectileProp) && projectileProp.ValueKind != JsonValueKind.Null)
            {
                projectile = projectileProp.GetString();
            }
            
            string? skillEffect = null;
            if (attackData.TryGetProperty("skillEffect", out var skillEffectProp))
            {
                skillEffect = skillEffectProp.GetString();
            }
            
            var bossAttack = new BossAttack
            {
                boss_id = bossId,
                attack_slot = attackSlot,
                damage = damage,
                range = range,
                cooldown = cooldown,
                knockback = knockback,
                hits = hits,
                attack_type = attackType,
                projectile = projectile,
                skill_effect = skillEffect
            };
            
            ctx.Db.BossAttack.Insert(bossAttack);
            Log.Info($"Added boss attack {attackSlot} for {bossId}: {attackType} damage={damage} range={range}");
        }
        catch (Exception ex)
        {
            Log.Error($"Failed to insert boss attack {attackSlot} for {bossId}: {ex.Message}");
        }
    }

}