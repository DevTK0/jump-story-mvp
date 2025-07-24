using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    [Reducer]
    public static void DamageEnemy(ReducerContext ctx, uint enemyId, AttackType attackType)
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

        var enemy = ctx.Db.Enemy.enemy_id.Find(enemyId);
        if (enemy is null)
        {
            Log.Info($"Enemy {enemyId} not found for damage");
            return;
        }

        // Don't damage already dead enemies
        if (enemy.Value.current_hp <= 0)
        {
            Log.Info($"Enemy {enemyId} is already dead");
            return;
        }

        // Server-side damage calculation based on attack type
        var damageResult = CalculateDamage(attackType, enemy.Value.enemy_type);

        // Apply damage if not immune
        if (damageResult.type != DamageType.Immune)
        {
            var oldHp = enemy.Value.current_hp;
            var newHp = Math.Max(0, enemy.Value.current_hp - damageResult.finalDamage);
            var newState = newHp <= 0 ? PlayerState.Dead : PlayerState.Damaged;
            var wasKilled = newHp <= 0 && oldHp > 0;

            // Calculate knockback position based on attacker's position
            var knockbackDistance = EnemyConstants.KNOCKBACK_DISTANCE;
            var knockbackDirection = enemy.Value.position.x > player.Value.position.x ? 1 : -1;
            
            var newX = enemy.Value.position.x + (knockbackDistance * knockbackDirection);
            
            // Get route boundaries to clamp knockback
            var route = ctx.Db.EnemyRoute.route_id.Find(enemy.Value.route_id);
            if (route != null)
            {
                var (leftBound, rightBound) = CalculateRouteBounds(route.Value);
                newX = Math.Max(leftBound, Math.Min(rightBound, newX));
            }
            
            var knockbackPosition = new DbVector2(newX, enemy.Value.position.y);

            // Update enemy health, state, and position with knockback
            // Also set aggro target to the attacking player
            var damagedEnemy = CreateEnemyUpdate(enemy.Value, knockbackPosition, enemy.Value.moving_right, 
                ctx.Sender, true, ctx.Timestamp, newState);
            damagedEnemy = damagedEnemy with { current_hp = newHp };
            ctx.Db.Enemy.enemy_id.Update(damagedEnemy);

            // Record damage event
            ctx.Db.EnemyDamageEvent.Insert(new EnemyDamageEvent
            {
                enemy_id = enemyId,
                player_identity = ctx.Sender,
                damage_amount = damageResult.finalDamage,
                damage_type = damageResult.type,
                timestamp = ctx.Timestamp
            });

            // Award experience if enemy was killed
            if (wasKilled)
            {
                AwardExperienceForKill(ctx, enemy.Value);
            }

            Log.Info($"Player {ctx.Sender} used {attackType} dealing {damageResult.finalDamage} {damageResult.type} damage to enemy {enemyId}. HP: {oldHp} -> {newHp}" + (wasKilled ? " [KILLED]" : ""));
        }
        else
        {
            // Record immune event
            ctx.Db.EnemyDamageEvent.Insert(new EnemyDamageEvent
            {
                enemy_id = enemyId,
                player_identity = ctx.Sender,
                damage_amount = 0,
                damage_type = DamageType.Immune,
                timestamp = ctx.Timestamp
            });

            Log.Info($"Player {ctx.Sender} {attackType} was immune against enemy {enemyId}");
        }
    }

    [Reducer]
    public static void RecoverFromDamage(ReducerContext ctx, uint enemyId)
    {
        var enemy = ctx.Db.Enemy.enemy_id.Find(enemyId);
        if (enemy is null || enemy.Value.state != PlayerState.Damaged)
        {
            return;
        }

        // Return enemy to idle state so they can resume patrol/chase
        var recoveredEnemy = CreateEnemyUpdate(enemy.Value, enemy.Value.position, enemy.Value.moving_right, 
            enemy.Value.aggro_target, enemy.Value.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
        ctx.Db.Enemy.enemy_id.Update(recoveredEnemy);

        Log.Info($"Enemy {enemyId} recovered from damage and returned to idle state");
    }

    /// <summary>
    /// Award experience to all contributors when an enemy is killed
    /// </summary>
    private static void AwardExperienceForKill(ReducerContext ctx, Enemy deadEnemy)
    {
        // Get enemy config for base EXP reward
        var enemyConfig = ctx.Db.EnemyConfig.enemy_type.Find(deadEnemy.enemy_type);
        if (enemyConfig == null)
        {
            Log.Warn($"Cannot award EXP - no config found for enemy type: {deadEnemy.enemy_type}");
            return;
        }

        // Get all damage events for this enemy to calculate contributions
        var damageEvents = new List<EnemyDamageEvent>();
        var playerDamageMap = new Dictionary<Identity, float>();
        
        foreach (var damageEvent in ctx.Db.EnemyDamageEvent.Iter())
        {
            if (damageEvent.enemy_id == deadEnemy.enemy_id && damageEvent.damage_amount > 0)
            {
                damageEvents.Add(damageEvent);
                
                // Aggregate damage by player
                if (playerDamageMap.ContainsKey(damageEvent.player_identity))
                {
                    playerDamageMap[damageEvent.player_identity] += damageEvent.damage_amount;
                }
                else
                {
                    playerDamageMap[damageEvent.player_identity] = damageEvent.damage_amount;
                }
            }
        }

        if (playerDamageMap.Count == 0)
        {
            Log.Warn($"No damage contributors found for killed enemy {deadEnemy.enemy_id}");
            return;
        }

        // Calculate total damage dealt
        float totalDamage = 0;
        foreach (var damage in playerDamageMap.Values)
        {
            totalDamage += damage;
        }
        
        // Award EXP to each contributor based on their damage percentage
        foreach (var (playerIdentity, damageDealt) in playerDamageMap)
        {
            var contributionPercentage = totalDamage > 0 ? damageDealt / totalDamage : 0f;
            
            // Get player info
            var player = ctx.Db.Player.identity.Find(playerIdentity);
            if (player == null) continue;

            // Calculate EXP gain based on contribution
            var expGained = (uint)Math.Max(1, Math.Round(enemyConfig.Value.base_exp_reward * contributionPercentage));
            
            // Award experience and check for level up
            AwardExperienceToPlayer(ctx, player.Value, expGained, deadEnemy, contributionPercentage);
        }

        // Note: Damage events are cleaned up by CleanupDeadBodies reducer after 5 seconds
        // This gives clients time to render all damage numbers including the killing blow
    }

    /// <summary>
    /// Award experience to a player and handle level ups
    /// </summary>
    private static void AwardExperienceToPlayer(ReducerContext ctx, Player player, uint expGained, Enemy killedEnemy, float contributionPercentage)
    {
        var oldLevel = player.level;
        var oldExp = player.experience;
        var newExp = oldExp + expGained;
        uint totalExpSpent = 0;
        
        // Check for level ups and calculate total exp spent
        var newLevel = oldLevel;
        while (true)
        {
            var nextLevelData = ctx.Db.PlayerLevelingConfig.level.Find(newLevel + 1);
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
        
        // Update player with new level and remaining experience
        var updatedPlayer = player with 
        { 
            experience = newExp,
            level = newLevel
        };
        ctx.Db.Player.identity.Update(updatedPlayer);

        // Log level ups
        if (newLevel > oldLevel)
        {
            Log.Info($"🎉 Player {player.identity} leveled up! {oldLevel} -> {newLevel}");
            if (totalExpSpent > 0)
            {
                Log.Info($"   Spent {totalExpSpent} EXP on level ups, {newExp} EXP remaining");
            }
        }

        Log.Info($"Player {player.identity} gained {expGained} EXP from {killedEnemy.enemy_type} (Level {killedEnemy.level}). " +
                $"Contribution: {contributionPercentage:P1}, Total EXP: {oldExp} -> {oldExp + expGained}, Current: {newExp}");
    }
}