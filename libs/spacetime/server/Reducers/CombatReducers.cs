using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{

    [Reducer]
    public static void RecoverFromDamage(ReducerContext ctx, uint spawnId)
    {
        var enemy = ctx.Db.Spawn.spawn_id.Find(spawnId);
        if (enemy is null || enemy.Value.state != PlayerState.Damaged)
        {
            return;
        }

        // Return enemy to idle state so they can resume patrol/chase
        var recoveredEnemy = CreateEnemyUpdate(enemy.Value, enemy.Value.x, enemy.Value.y, enemy.Value.moving_right, 
            enemy.Value.aggro_target, enemy.Value.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
        ctx.Db.Spawn.spawn_id.Update(recoveredEnemy);

        Log.Info($"Enemy {spawnId} recovered from damage and returned to idle state");
    }

    [Reducer]
    public static void DamageEnemy(ReducerContext ctx, List<uint> spawnIds, AttackType attackType)
    {
        // Check if the attacking player is dead
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player == null)
        {
            Log.Info($"Player not found for attack: {ctx.Sender}");
            return;
        }

        // Check if player is banned
        if (player.Value.ban_status)
        {
            Log.Info($"Banned player {ctx.Sender} attempted to attack");
            return;
        }

        if (player.Value.current_hp <= 0 || player.Value.state == PlayerState.Dead)
        {
            Log.Info($"Dead player {ctx.Sender} cannot attack");
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
            Log.Info($"Player {ctx.Sender} insufficient mana: {player.Value.current_mana} < {jobAttack.Value.mana_cost}");
            return;
        }

        // Note: Cooldowns are now tracked on the client side for responsiveness

        // Deduct mana cost and enter combat
        var currentPlayer = player.Value;
        if (jobAttack.Value.mana_cost > 0)
        {
            currentPlayer = currentPlayer with { current_mana = currentPlayer.current_mana - jobAttack.Value.mana_cost };
            ctx.Db.Player.identity.Update(currentPlayer);
        }
        
        // Enter combat state when attacking (with current player data)
        CombatService.EnterCombat(ctx, currentPlayer);

        var damageCount = 0;
        var killCount = 0;
        var maxTargets = jobAttack.Value.targets; // Use attack's target count

        // Fetch all enemies in the provided list and filter out dead/invalid ones
        var allEnemies = new List<Spawn>();
        foreach (var enemy in ctx.Db.Spawn.Iter())
        {
            if (spawnIds.Contains(enemy.spawn_id) && enemy.current_hp > 0)
            {
                // Check if enemy is within attack range (X-axis only)
                var xDistance = Math.Abs(enemy.x - player.Value.x);
                const float rangeLeniency = 20f; // Base leniency for all attacks
                
                if (xDistance <= jobAttack.Value.range + rangeLeniency)
                {
                    allEnemies.Add(enemy);
                }
            }
        }
        
        // Sort by distance from player and take only up to maxTargets
        var validEnemies = allEnemies
            .OrderBy(e => Math.Abs(e.x - player.Value.x))
            .Take(maxTargets)
            .ToList();

        Log.Info($"Attack {jobAttack.Value.name}: range={jobAttack.Value.range}, targets={maxTargets}");
        Log.Info($"Found {validEnemies.Count} valid enemies within range out of {spawnIds.Count} provided");

        // Process damage for each valid enemy
        foreach (var enemy in validEnemies)
        {
            var currentHp = enemy.current_hp;
            
            // Get enemy data to check invulnerability
            bool isInvulnerable = false;
            
            if (enemy.enemy_type == EnemyType.Boss)
            {
                // Bosses are never invulnerable (they're stored in Boss table, not Enemy table)
                isInvulnerable = false;
            }
            else
            {
                // Regular enemies - check Enemy table for invulnerability
                var enemyData = ctx.Db.Enemy.name.Find(enemy.enemy);
                isInvulnerable = enemyData?.invulnerable ?? false;
            }
            
            // Apply multiple hits if specified
            for (int hit = 0; hit < jobAttack.Value.hits; hit++)
            {
                // Skip if enemy is already dead
                if (currentHp <= 0) break;
                
                // Check if enemy is invulnerable
                DamageType damageType;
                uint finalDamage;
                float baseDamage = 0;
                float scaledDamage = 0;
                
                if (isInvulnerable)
                {
                    // Enemy is invulnerable - set damage type to Immune and damage to 0
                    damageType = DamageType.Immune;
                    finalDamage = 0;
                }
                else
                {
                    // Use job attack damage as base damage
                    baseDamage = jobAttack.Value.damage;
                    
                    // Apply level scaling to damage
                    scaledDamage = PlayerConstants.CalculateScaledDamage(player.Value.level, (uint)baseDamage);
                    
                    // Apply critical hit based on attack's crit chance
                    var random = new Random();
                    var isCritical = jobAttack.Value.crit_chance > 0 && random.NextDouble() < jobAttack.Value.crit_chance;
                    damageType = isCritical ? DamageType.Crit : DamageType.Normal;
                    
                    // Apply damage multiplier (1.5x for crit, 1.0x for normal) and floor to prevent decimals
                    finalDamage = (uint)Math.Floor(scaledDamage * DamageCalculator.GetDamageMultiplier(damageType));
                }

                    var oldHp = currentHp;
                    var newHp = Math.Max(0, (float)Math.Floor(currentHp - finalDamage));
                    var wasKilled = newHp <= 0 && oldHp > 0;

                    // Determine new state based on enemy type and current state
                    PlayerState newState;
                    if (newHp <= 0)
                    {
                        newState = PlayerState.Dead;
                    }
                    else if (enemy.enemy_type == EnemyType.Boss)
                    {
                        // Bosses: NEVER enter Damaged state - they keep their current state
                        // This prevents stun-locking where bosses get stuck in Damaged->Idle loops
                        newState = enemy.state; // Always keep current state (Idle, Walk, or Attack)
                    }
                    else
                    {
                        // Regular enemies always go to Damaged state
                        newState = PlayerState.Damaged;
                    }

                    // Calculate knockback for non-boss enemies only
                    float knockbackX = enemy.x;
                    float knockbackY = enemy.y;
                    
                    if (enemy.enemy_type != EnemyType.Boss)
                    {
                        // Apply knockback for regular enemies
                        var knockbackDistance = jobAttack.Value.knockback;
                        var knockbackDirection = enemy.x > player.Value.x ? 1 : -1;
                        var newX = enemy.x + (knockbackDistance * knockbackDirection);
                        
                        // Get route boundaries to clamp knockback
                        var route = ctx.Db.SpawnRoute.route_id.Find(enemy.route_id);
                        if (route != null)
                        {
                            var (leftBound, rightBound) = CalculateRouteBounds(route.Value);
                            newX = Math.Max(leftBound, Math.Min(rightBound, newX));
                        }
                        
                        knockbackX = newX;
                    }
                    // Bosses stay at their current position (no knockback)

                    // Update enemy health, state, and position
                    // Also set aggro target to the attacking player
                    var damagedEnemy = CreateEnemyUpdate(enemy, knockbackX, knockbackY, enemy.moving_right, 
                        ctx.Sender, true, ctx.Timestamp, newState);
                    damagedEnemy = damagedEnemy with { current_hp = newHp };
                    ctx.Db.Spawn.spawn_id.Update(damagedEnemy);

                // Record damage event
                ctx.Db.EnemyDamageEvent.Insert(new EnemyDamageEvent
                {
                    spawn_id = enemy.spawn_id,
                    player_identity = ctx.Sender,
                    damage_amount = finalDamage,
                    damage_type = damageType,
                    projectile = jobAttack.Value.projectile ?? null, // Pass projectile effect if present
                    skill_effect = jobAttack.Value.skill_effect, // Pass skill effect if present
                    timestamp = ctx.Timestamp
                });

                damageCount++;

                // Award experience if enemy was killed
                if (wasKilled)
                {
                    ExperienceService.AwardExperienceForKill(ctx, enemy);
                    killCount++;
                    
                    // Only check boss triggers for regular enemies
                    if (enemy.enemy_type == EnemyType.Regular)
                    {
                        CheckBossTrigger(ctx, enemy.enemy);
                    }
                    // Cleanup boss when it dies
                    else if (enemy.enemy_type == EnemyType.Boss)
                    {
                        CleanupBoss(ctx, enemy, "defeated");
                    }
                    
                    break; // Don't continue hitting a dead enemy
                }

                if (isInvulnerable)
                {
                    Log.Info($"Player {ctx.Sender} (Lv{player.Value.level}) used {jobAttack.Value.name} (hit {hit+1}/{jobAttack.Value.hits}) on INVULNERABLE enemy {enemy.spawn_id}. Damage: 0 (IMMUNE)");
                }
                else
                {
                    Log.Info($"Player {ctx.Sender} (Lv{player.Value.level}) used {jobAttack.Value.name} (hit {hit+1}/{jobAttack.Value.hits}) dealing {finalDamage} {damageType} damage (base: {baseDamage}, scaled: {scaledDamage:F0}) to enemy {enemy.spawn_id}. HP: {oldHp} -> {newHp}" + (wasKilled ? " [KILLED]" : ""));
                }
                
                // Update current HP for next hit
                currentHp = newHp;
            }
        }

        // Apply mana leech if the attack has it and enemies were hit
        if (jobAttack.Value.mana_leech > 0 && damageCount > 0)
        {
            // Calculate total mana to restore (mana_leech per enemy hit)
            var manaToRestore = jobAttack.Value.mana_leech * (uint)damageCount;
            
            // Get current player state (may have been updated during combat)
            var updatedPlayer = ctx.Db.Player.identity.Find(ctx.Sender);
            if (updatedPlayer != null)
            {
                // Calculate new mana, capped at max_mana
                var newMana = Math.Min(updatedPlayer.Value.current_mana + manaToRestore, updatedPlayer.Value.max_mana);
                
                // Only update if mana actually increased
                if (newMana > updatedPlayer.Value.current_mana)
                {
                    var playerWithMana = updatedPlayer.Value with { current_mana = newMana };
                    ctx.Db.Player.identity.Update(playerWithMana);
                    
                    Log.Info($"Player {ctx.Sender} restored {newMana - updatedPlayer.Value.current_mana} mana from {jobAttack.Value.name} leech (hit {damageCount} enemies)");
                }
            }
        }

        // Apply HP leech if the attack has it and enemies were hit
        if (jobAttack.Value.hp_leech > 0 && damageCount > 0)
        {
            // Calculate total HP to restore (hp_leech per enemy hit)
            var hpToRestore = PlayerConstants.CalculateHpLeech(jobAttack.Value.hp_leech, player.Value.level) * (uint)damageCount;
            
            // Get current player state (may have been updated during combat)
            var updatedPlayer = ctx.Db.Player.identity.Find(ctx.Sender);
            if (updatedPlayer != null)
            {
                // Calculate new HP, capped at max_hp
                var newHp = Math.Min(updatedPlayer.Value.current_hp + hpToRestore, updatedPlayer.Value.max_hp);
                
                // Only update if HP actually increased
                if (newHp > updatedPlayer.Value.current_hp)
                {
                    var playerWithHp = updatedPlayer.Value with { current_hp = newHp };
                    ctx.Db.Player.identity.Update(playerWithHp);
                    
                    Log.Info($"Player {ctx.Sender} restored {newHp - updatedPlayer.Value.current_hp} HP from {jobAttack.Value.name} leech (hit {damageCount} enemies)");
                }
            }
        }

        Log.Info($"Player {ctx.Sender} used attack {attackSlot} ({jobAttack.Value.name}) at {ctx.Timestamp}");

        Log.Info($"Player {ctx.Sender} attack hit {damageCount} enemies, killed {killCount}");
    }

    [Reducer]
    public static void HealPartyMembers(ReducerContext ctx, AttackType attackType)
    {
        // Validate healer
        var healer = ctx.Db.Player.identity.Find(ctx.Sender);
        if (healer == null || healer.Value.ban_status || healer.Value.current_hp <= 0)
            return;

        // Get heal attack configuration
        var job = ctx.Db.Job.job_key.Find(healer.Value.job);
        if (job == null) return;

        byte attackSlot = attackType switch
        {
            AttackType.Attack1 => 1,
            AttackType.Attack2 => 2,
            AttackType.Attack3 => 3,
            _ => 1
        };

        JobAttack? healAttack = null;
        foreach (var attack in ctx.Db.JobAttack.Iter())
        {
            if (attack.job_id == job.Value.job_id && 
                attack.attack_slot == attackSlot && 
                attack.attack_type == "heal")
            {
                healAttack = attack;
                break;
            }
        }

        if (healAttack == null) return;

        // Check mana
        if (healer.Value.current_mana < healAttack.Value.mana_cost)
            return;

        // Deduct mana
        var currentHealer = healer.Value with { 
            current_mana = healer.Value.current_mana - healAttack.Value.mana_cost 
        };
        ctx.Db.Player.identity.Update(currentHealer);

        // Get healer's party
        var membership = ctx.Db.PartyMember.player_identity.Find(ctx.Sender);
        
        // Build list of potential heal targets
        var potentialTargets = new List<Identity>();
        
        if (membership != null)
        {
            // If in a party, add all party members
            var partyMembers = ctx.Db.PartyMember.Iter()
                .Where(m => m.party_id == membership.Value.party_id)
                .Select(m => m.player_identity)
                .ToList();
            potentialTargets.AddRange(partyMembers);
        }
        else
        {
            // If not in a party, can only heal self
            potentialTargets.Add(ctx.Sender);
        }

        var healCount = 0;
        var maxTargets = healAttack.Value.targets;

        foreach (var targetIdentity in potentialTargets)
        {
            if (healCount >= maxTargets) break;

            var target = ctx.Db.Player.identity.Find(targetIdentity);
            if (target == null || target.Value.current_hp <= 0 || target.Value.current_hp >= target.Value.max_hp)
                continue;

            // Check range
            var distance = Math.Abs(target.Value.x - healer.Value.x);
            if (distance > healAttack.Value.range + 20f) // 20f range leniency
                continue;

            // Apply healing
            var healAmount = healAttack.Value.damage; // Using damage as heal amount
            var newHp = Math.Min(target.Value.current_hp + healAmount, target.Value.max_hp);
            
            var healedPlayer = target.Value with { current_hp = newHp };
            ctx.Db.Player.identity.Update(healedPlayer);
            healCount++;

            // Record heal event
            ctx.Db.PlayerHealEvent.Insert(new PlayerHealEvent
            {
                healer_identity = ctx.Sender,
                target_identity = targetIdentity,
                heal_amount = healAmount,
                ability_name = healAttack.Value.name,
                skill_effect = healAttack.Value.skill_effect, // Pass skill effect if present
                timestamp = ctx.Timestamp
            });

            Log.Info($"{healer.Value.name} healed {target.Value.name} for {healAmount}. HP: {target.Value.current_hp} -> {newHp}");
        }
    }

    private static void CheckBossTrigger(ReducerContext ctx, string enemyType)
    {
        // Check if there's a boss trigger for this enemy type
        var trigger = ctx.Db.BossTrigger.enemy_type.Find(enemyType);
        if (trigger == null || !trigger.Value.active)
        {
            return;
        }

        // Increment kill count
        var updatedTrigger = trigger.Value with { current_kills = trigger.Value.current_kills + 1 };
        
        // Check if we've reached the required kills
        if (updatedTrigger.current_kills >= updatedTrigger.required_kills)
        {
            Log.Info($"Boss trigger met! {enemyType} kills: {updatedTrigger.current_kills}/{updatedTrigger.required_kills}");
            
            // Spawn the boss (this will handle the announcement if successful)
            SpawnBossFromTrigger(ctx, updatedTrigger.boss_to_spawn, trigger.Value.required_kills, enemyType);
            
            // Reset the kill count
            updatedTrigger = updatedTrigger with { current_kills = 0 };
        }
        
        // Update the trigger
        ctx.Db.BossTrigger.enemy_type.Update(updatedTrigger);
        
        if (updatedTrigger.current_kills % 5 == 0 && updatedTrigger.current_kills > 0)
        {
            Log.Info($"Boss trigger progress: {enemyType} kills: {updatedTrigger.current_kills}/{updatedTrigger.required_kills}");
        }
    }

    private static void SpawnBossFromTrigger(ReducerContext ctx, string bossId, uint requiredKills, string enemyType)
    {
        // Check if a boss already exists (prevent multiple boss spawns)
        foreach (var existingSpawn in ctx.Db.Spawn.Iter())
        {
            if (existingSpawn.enemy_type == EnemyType.Boss && existingSpawn.state != PlayerState.Dead)
            {
                Log.Info($"Boss spawn blocked - another boss is already active: {existingSpawn.enemy}");
                return;
            }
        }

        // Get boss data
        var boss = ctx.Db.Boss.boss_id.Find(bossId);
        if (boss == null)
        {
            Log.Error($"Boss type '{bossId}' not found for trigger spawn");
            return;
        }

        // Find the boss route
        BossRoute? bossRoute = null;
        foreach (var route in ctx.Db.BossRoute.Iter())
        {
            if (route.boss_id == bossId)
            {
                bossRoute = route;
                break;
            }
        }

        if (bossRoute == null)
        {
            Log.Warn($"No route found for boss '{bossId}', cannot spawn from trigger");
            return;
        }

        // Calculate spawn position within the boss spawn area
        var spawnX = bossRoute.Value.spawn_area.position.x + (bossRoute.Value.spawn_area.size.x / 2);
        var spawnY = bossRoute.Value.spawn_area.position.y + (bossRoute.Value.spawn_area.size.y / 2);

        // Create boss spawn using unified Spawn table
        var bossSpawn = new Spawn
        {
            route_id = bossRoute.Value.route_id,
            enemy = bossId, // Boss ID goes in enemy field
            x = spawnX,
            y = spawnY,
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
        Log.Info($"Spawned boss '{boss.Value.display_name}' at ({spawnX}, {spawnY}) from trigger");
        
        // Announce boss spawn (only after successful spawn)
        var announcement = new Broadcast
        {
            message = $"A powerful enemy has appeared! {boss.Value.display_name} has been summoned!",
            publish_dt = ctx.Timestamp
        };
        ctx.Db.Broadcast.Insert(announcement);
    }

    private static void ResetBossTrigger(ReducerContext ctx, string bossId)
    {
        // Find the trigger that spawns this boss
        foreach (var trigger in ctx.Db.BossTrigger.Iter())
        {
            if (trigger.boss_to_spawn == bossId && trigger.current_kills > 0)
            {
                var resetTrigger = trigger with { current_kills = 0 };
                ctx.Db.BossTrigger.enemy_type.Update(resetTrigger);
                Log.Info($"Reset trigger for {trigger.enemy_type} after boss {bossId} died: {trigger.current_kills} -> 0");
                break;
            }
        }
    }

    private static void CleanupBoss(ReducerContext ctx, Spawn boss, string reason)
    {
        // 1. Clean up BossAttackState entries
        var attackStatesToRemove = new List<uint>();
        foreach (var attackState in ctx.Db.BossAttackState.Iter())
        {
            if (attackState.spawn_id == boss.spawn_id)
            {
                attackStatesToRemove.Add(attackState.state_id);
            }
        }
        foreach (var stateId in attackStatesToRemove)
        {
            ctx.Db.BossAttackState.state_id.Delete(stateId);
        }
        Log.Info($"Cleaned up {attackStatesToRemove.Count} BossAttackState entries for boss {boss.spawn_id}");
        
        // 2. Reset boss trigger
        ResetBossTrigger(ctx, boss.enemy);
        
        // 3. Send appropriate broadcast
        var bossData = ctx.Db.Boss.boss_id.Find(boss.enemy);
        if (bossData != null)
        {
            var message = reason == "defeated" 
                ? $"{bossData.Value.display_name} has been defeated!"
                : $"{bossData.Value.display_name} has left the battlefield!";
            
            ctx.Db.Broadcast.Insert(new Broadcast {
                message = message,
                publish_dt = ctx.Timestamp
            });
        }
        
        // 4. Delete the boss spawn if despawning due to timeout
        if (reason == "timeout")
        {
            // First, delete all damage events for this boss
            var damageEventsToRemove = new List<uint>();
            foreach (var damageEvent in ctx.Db.EnemyDamageEvent.Iter())
            {
                if (damageEvent.spawn_id == boss.spawn_id)
                {
                    damageEventsToRemove.Add(damageEvent.damage_event_id);
                }
            }
            
            foreach (var damageEventId in damageEventsToRemove)
            {
                ctx.Db.EnemyDamageEvent.damage_event_id.Delete(damageEventId);
            }
            
            // Then delete the boss spawn
            ctx.Db.Spawn.spawn_id.Delete(boss.spawn_id);
            Log.Info($"Boss {boss.enemy} despawned due to {reason}");
        }
    }

}