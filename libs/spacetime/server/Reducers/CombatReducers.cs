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

        // Check cooldowns
        var playerCooldown = ctx.Db.PlayerCooldown.player_identity.Find(ctx.Sender);
        if (playerCooldown == null)
        {
            Log.Error($"PlayerCooldown not found for player {ctx.Sender}");
            return;
        }

        // Check if the attack is on cooldown
        var currentTime = ctx.Timestamp;
        var lastUsed = attackSlot switch
        {
            1 => playerCooldown.Value.attack1_last_used,
            2 => playerCooldown.Value.attack2_last_used,
            3 => playerCooldown.Value.attack3_last_used,
            _ => currentTime - TimeSpan.FromDays(1) // Default to long ago
        };

        // Calculate when the attack can be used again
        var cooldownDuration = TimeSpan.FromSeconds(jobAttack.Value.cooldown);
        var canUseAt = lastUsed + cooldownDuration;

        Log.Info($"Cooldown check - Attack: {jobAttack.Value.name}, Slot: {attackSlot}, Cooldown: {jobAttack.Value.cooldown}s");
        Log.Info($"Last used: {lastUsed}, Current time: {currentTime}, Can use at: {canUseAt}");

        if (canUseAt > currentTime)
        {
            Log.Info($"Player {ctx.Sender} attack {attackSlot} is still on cooldown");
            return;
        }

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
            
            // Apply multiple hits if specified
            for (int hit = 0; hit < jobAttack.Value.hits; hit++)
            {
                // Skip if enemy is already dead
                if (currentHp <= 0) break;
                
                // Use job attack damage as base damage
                var baseDamage = jobAttack.Value.damage;
                
                // Apply level scaling to damage
                var scaledDamage = PlayerConstants.CalculateScaledDamage(player.Value.level, baseDamage);
                
                // Apply critical hit based on attack's crit chance
                var random = new Random();
                var isCritical = jobAttack.Value.crit_chance > 0 && random.NextDouble() < jobAttack.Value.crit_chance;
                var damageType = isCritical ? DamageType.Crit : DamageType.Normal;
                
                // Apply damage multiplier (1.5x for crit, 1.0x for normal)
                var finalDamage = (uint)(scaledDamage * DamageCalculator.GetDamageMultiplier(damageType));

                    var oldHp = currentHp;
                    var newHp = Math.Max(0, currentHp - finalDamage);
                    var newState = newHp <= 0 ? PlayerState.Dead : PlayerState.Damaged;
                    var wasKilled = newHp <= 0 && oldHp > 0;

                    // Calculate knockback position based on attacker's position and attack's knockback value
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
                
                var knockbackX = newX;
                var knockbackY = enemy.y;

                    // Update enemy health, state, and position with knockback
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
                    timestamp = ctx.Timestamp
                });

                damageCount++;

                // Award experience if enemy was killed
                if (wasKilled)
                {
                    ExperienceService.AwardExperienceForKill(ctx, enemy);
                    killCount++;
                    break; // Don't continue hitting a dead enemy
                }

                Log.Info($"Player {ctx.Sender} (Lv{player.Value.level}) used {jobAttack.Value.name} (hit {hit+1}/{jobAttack.Value.hits}) dealing {finalDamage} {damageType} damage (base: {baseDamage}, scaled: {scaledDamage:F0}) to enemy {enemy.spawn_id}. HP: {oldHp} -> {newHp}" + (wasKilled ? " [KILLED]" : ""));
                
                // Update current HP for next hit
                currentHp = newHp;
            }
        }

        // Update attack last used time after successful attack
        var updatedCooldown = playerCooldown.Value;
        
        switch (attackSlot)
        {
            case 1:
                updatedCooldown = updatedCooldown with { attack1_last_used = ctx.Timestamp };
                break;
            case 2:
                updatedCooldown = updatedCooldown with { attack2_last_used = ctx.Timestamp };
                break;
            case 3:
                updatedCooldown = updatedCooldown with { attack3_last_used = ctx.Timestamp };
                break;
        }
        
        ctx.Db.PlayerCooldown.player_identity.Update(updatedCooldown);
        Log.Info($"Player {ctx.Sender} used attack {attackSlot} at {ctx.Timestamp}");

        Log.Info($"Player {ctx.Sender} attack hit {damageCount} enemies, killed {killCount}");
    }

}