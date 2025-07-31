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

        // Clear existing bosses first
        var bossesToRemove = new List<string>();
        foreach (var boss in ctx.Db.Boss.Iter())
        {
            bossesToRemove.Add(boss.boss_id);
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

        // Create boss spawn
        var bossSpawn = new BossSpawn
        {
            route_id = route.Value.route_id,
            boss_id = bossId,
            x = x,
            y = y,
            state = PlayerState.Idle,
            facing = FacingDirection.Right,
            current_hp = boss.Value.base_health,
            max_hp = boss.Value.base_health,
            spawn_time = ctx.Timestamp,
            last_updated = ctx.Timestamp,
            current_target = null
        };

        ctx.Db.BossSpawn.Insert(bossSpawn);
        Log.Info($"Spawned boss '{boss.Value.display_name}' at ({x}, {y})");

        // Send standardized spawn announcement
        var announcement = new Broadcast
        {
            message = $"{boss.Value.display_name} has appeared!",
            publish_dt = ctx.Timestamp
        };
        ctx.Db.Broadcast.Insert(announcement);
    }

    [Reducer]
    public static void DamageBoss(ReducerContext ctx, List<uint> bossSpawnIds, AttackType attackType)
    {
        // Check if the attacking player exists and is alive
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for boss attack: {ctx.Sender}");
            return;
        }

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to attack boss");
            return;
        }

        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            Log.Info($"Dead player {ctx.Sender} cannot attack boss");
            return;
        }

        // Look up the player's job
        var job = ctx.Db.Job.job_key.Find(player.Value.job);
        if (job == null)
        {
            Log.Error($"Job {player.Value.job} not found for player {ctx.Sender}");
            return;
        }

        // Determine which attack slot based on AttackType enum
        byte attackSlot = attackType switch
        {
            AttackType.Attack1 => 1,
            AttackType.Attack2 => 2,
            AttackType.Attack3 => 3,
            _ => 1
        };

        // Find the specific attack for this job and slot
        JobAttack? jobAttack = null;
        foreach (var attack in ctx.Db.JobAttack.Iter())
        {
            if (attack.job_id == job.Value.job_id && attack.attack_slot == attackSlot)
            {
                jobAttack = attack;
                break;
            }
        }

        if (jobAttack == null)
        {
            Log.Error($"Attack slot {attackSlot} not found for job {player.Value.job}");
            return;
        }

        // Check if player has enough mana
        if (player.Value.current_mana < jobAttack.Value.mana_cost)
        {
            Log.Info($"Player {ctx.Sender} insufficient mana for boss attack: {player.Value.current_mana} < {jobAttack.Value.mana_cost}");
            return;
        }

        // Deduct mana cost and enter combat
        var currentPlayer = player.Value;
        if (jobAttack.Value.mana_cost > 0)
        {
            currentPlayer = currentPlayer with { current_mana = currentPlayer.current_mana - jobAttack.Value.mana_cost };
            ctx.Db.Player.identity.Update(currentPlayer);
        }
        
        // Enter combat state
        CombatService.EnterCombat(ctx, currentPlayer);

        var damageCount = 0;
        var killCount = 0;
        var maxTargets = jobAttack.Value.targets;

        // Process damage for each valid boss
        foreach (var bossSpawnId in bossSpawnIds.Take(maxTargets))
        {
            var bossSpawn = ctx.Db.BossSpawn.boss_spawn_id.Find(bossSpawnId);
            if (bossSpawn == null || bossSpawn.Value.current_hp <= 0)
            {
                continue;
            }

            // Get boss data for calculations
            var boss = ctx.Db.Boss.boss_id.Find(bossSpawn.Value.boss_id);
            if (boss == null)
            {
                Log.Error($"Boss data not found for boss_id: {bossSpawn.Value.boss_id}");
                continue;
            }

            var currentHp = bossSpawn.Value.current_hp;
            
            // Apply multiple hits if specified
            for (int hit = 0; hit < jobAttack.Value.hits; hit++)
            {
                // Skip if boss is already dead
                if (currentHp <= 0) break;
                
                // Use job attack damage as base damage
                var baseDamage = jobAttack.Value.damage;
                
                // Apply level scaling to damage
                var scaledDamage = PlayerConstants.CalculateScaledDamage(player.Value.level, baseDamage);
                
                // Calculate damage result (simplified for bosses)
                var damageType = DamageType.Normal; // Simplified for now
                var finalDamage = scaledDamage;
                
                // Apply damage
                var oldHp = currentHp;
                currentHp = Math.Max(0, currentHp - finalDamage);
                var newHp = currentHp;
                var actualDamage = oldHp - newHp;
                
                // Update boss spawn with new HP
                var updatedBossSpawn = bossSpawn.Value with 
                { 
                    current_hp = newHp,
                    last_updated = ctx.Timestamp,
                    state = newHp <= 0 ? PlayerState.Dead : bossSpawn.Value.state
                };
                ctx.Db.BossSpawn.boss_spawn_id.Update(updatedBossSpawn);
                
                // Insert damage event for tracking
                var damageEvent = new BossDamageEvent
                {
                    boss_spawn_id = bossSpawnId,
                    player_identity = ctx.Sender,
                    damage_amount = actualDamage,
                    damage_type = damageType,
                    projectile = jobAttack.Value.projectile,
                    skill_effect = jobAttack.Value.skill_effect,
                    attack_type = attackType,
                    timestamp = ctx.Timestamp
                };
                ctx.Db.BossDamageEvent.Insert(damageEvent);

                // Check if boss was killed
                var wasKilled = oldHp > 0 && newHp <= 0;
                if (wasKilled)
                {
                    killCount++;
                    HandleBossDefeat(ctx, updatedBossSpawn, boss.Value);
                    break; // Don't continue hitting a dead boss
                }

                Log.Info($"Player {ctx.Sender} (Lv{player.Value.level}) dealt {finalDamage} damage to boss {boss.Value.display_name}. HP: {oldHp} -> {newHp}" + (wasKilled ? " [KILLED]" : ""));
                
                // Update current HP for next hit
                currentHp = newHp;
            }
            
            damageCount++;
        }

        if (damageCount > 0)
        {
            Log.Info($"Player {ctx.Sender} damaged {damageCount} boss(es), killed {killCount}");
        }
    }

    private static void HandleBossDefeat(ReducerContext ctx, BossSpawn defeatedBoss, Boss bossData)
    {
        // Award experience to all contributors
        AwardBossExperience(ctx, defeatedBoss, bossData);

        // Send standardized defeat announcement
        var announcement = new Broadcast
        {
            message = $"{bossData.display_name} has been defeated!",
            publish_dt = ctx.Timestamp
        };
        ctx.Db.Broadcast.Insert(announcement);

        Log.Info($"Boss {bossData.display_name} defeated!");
    }

    private static void AwardBossExperience(ReducerContext ctx, BossSpawn defeatedBoss, Boss bossData)
    {
        // Calculate damage contributions
        var playerDamageMap = new Dictionary<Identity, float>();
        float totalDamage = 0;

        // Aggregate damage by player
        foreach (var damageEvent in ctx.Db.BossDamageEvent.Iter())
        {
            if (damageEvent.boss_spawn_id == defeatedBoss.boss_spawn_id && damageEvent.damage_amount > 0)
            {
                if (playerDamageMap.ContainsKey(damageEvent.player_identity))
                {
                    playerDamageMap[damageEvent.player_identity] += damageEvent.damage_amount;
                }
                else
                {
                    playerDamageMap[damageEvent.player_identity] = damageEvent.damage_amount;
                }
                totalDamage += damageEvent.damage_amount;
            }
        }

        // Award EXP to each contributor
        foreach (var kvp in playerDamageMap)
        {
            var player = ctx.Db.Player.identity.Find(kvp.Key);
            if (player == null) continue;

            // Calculate contribution percentage
            var contributionPercentage = totalDamage > 0 ? kvp.Value / totalDamage : 0f;
            
            // Calculate EXP gain based on contribution
            var expGained = (uint)Math.Max(1, Math.Round(bossData.exp_reward * contributionPercentage));

            // Boss-specific experience award (simplified from ExperienceService)
            var levelUpResult = CalculateLevelUp(ctx, player.Value, expGained);

            // Update player with new level and experience
            var updatedPlayer = player.Value with
            {
                experience = levelUpResult.RemainingExp,
                level = levelUpResult.NewLevel
            };

            // If player leveled up, calculate new max stats
            if (levelUpResult.LevelsGained > 0)
            {
                var job = ctx.Db.Job.job_key.Find(player.Value.job);
                if (job != null)
                {
                    updatedPlayer = updatedPlayer with
                    {
                        max_hp = PlayerConstants.CalculateMaxHpWithJob(levelUpResult.NewLevel, job.Value.health),
                        max_mana = PlayerConstants.CalculateMaxManaWithJob(levelUpResult.NewLevel, job.Value.mana),
                        current_hp = PlayerConstants.CalculateMaxHpWithJob(levelUpResult.NewLevel, job.Value.health), // Full heal
                        current_mana = PlayerConstants.CalculateMaxManaWithJob(levelUpResult.NewLevel, job.Value.mana) // Full mana
                    };
                }

                Log.Info($"Player {player.Value.identity} leveled up! {player.Value.level} -> {levelUpResult.NewLevel}");
            }

            ctx.Db.Player.identity.Update(updatedPlayer);

            Log.Info($"Player {player.Value.identity} gained {expGained} EXP from {bossData.boss_id} (Level {bossData.level}). " +
                    $"Contribution: {contributionPercentage:P1}");
        }
    }

    // Simplified level up calculation (copied from ExperienceService)
    private static LevelUpResult CalculateLevelUp(ReducerContext ctx, Player player, uint expGained)
    {
        var oldLevel = player.level;
        var oldExp = player.experience;
        var newExp = oldExp + expGained;
        uint totalExpSpent = 0;
        var newLevel = oldLevel;

        // Check for level ups
        while (true)
        {
            var nextLevelData = ctx.Db.PlayerLevel.level.Find(newLevel + 1);
            if (nextLevelData == null)
            {
                // No more levels defined
                break;
            }

            if (newExp >= nextLevelData.Value.exp_required)
            {
                // Subtract the experience required for this level
                newExp -= nextLevelData.Value.exp_required;
                totalExpSpent += nextLevelData.Value.exp_required;
                newLevel++;
            }
            else
            {
                break;
            }
        }

        return new LevelUpResult
        {
            NewLevel = newLevel,
            RemainingExp = newExp,
            ExpSpent = totalExpSpent,
            LevelsGained = newLevel - oldLevel
        };
    }

    private class LevelUpResult
    {
        public uint NewLevel { get; set; }
        public uint RemainingExp { get; set; }
        public uint ExpSpent { get; set; }
        public uint LevelsGained { get; set; }
    }


}