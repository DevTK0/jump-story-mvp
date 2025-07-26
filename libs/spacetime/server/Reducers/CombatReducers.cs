using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{

    [Reducer]
    public static void RecoverFromDamage(ReducerContext ctx, uint enemyId)
    {
        var enemy = ctx.Db.Enemy.enemy_id.Find(enemyId);
        if (enemy is null || enemy.Value.state != PlayerState.Damaged)
        {
            return;
        }

        // Return enemy to idle state so they can resume patrol/chase
        var recoveredEnemy = CreateEnemyUpdate(enemy.Value, enemy.Value.x, enemy.Value.y, enemy.Value.moving_right, 
            enemy.Value.aggro_target, enemy.Value.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
        ctx.Db.Enemy.enemy_id.Update(recoveredEnemy);

        Log.Info($"Enemy {enemyId} recovered from damage and returned to idle state");
    }

    [Reducer]
    public static void DamageEnemy(ReducerContext ctx, List<uint> enemyIds, AttackType attackType)
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

        var damageCount = 0;
        var killCount = 0;
        const int maxTargets = 3; // Cap at 3 enemies for now

        // Fetch all enemies in the provided list and filter out dead/invalid ones
        var allEnemies = new List<Enemy>();
        foreach (var enemy in ctx.Db.Enemy.Iter())
        {
            if (enemyIds.Contains(enemy.enemy_id) && enemy.current_hp > 0)
            {
                allEnemies.Add(enemy);
            }
        }
        
        // Sort by distance from player and take only up to maxTargets
        var validEnemies = allEnemies
            .OrderBy(e => Math.Abs(e.x - player.Value.x))
            .Take(maxTargets)
            .ToList();

        Log.Info($"Found {validEnemies.Count} valid enemies out of {enemyIds.Count} provided");

        // Process damage for each valid enemy
        foreach (var enemy in validEnemies)
        {
            // Server-side damage calculation based on attack type
            var damageResult = DamageCalculator.CalculateDamage(attackType, enemy.enemy_type);

            // Apply damage if not immune
            if (damageResult.type != DamageType.Immune)
            {
                var oldHp = enemy.current_hp;
                var newHp = Math.Max(0, enemy.current_hp - damageResult.finalDamage);
                var newState = newHp <= 0 ? PlayerState.Dead : PlayerState.Damaged;
                var wasKilled = newHp <= 0 && oldHp > 0;

                // Calculate knockback position based on attacker's position
                var knockbackDistance = EnemyConstants.KNOCKBACK_DISTANCE;
                var knockbackDirection = enemy.x > player.Value.x ? 1 : -1;
                
                var newX = enemy.x + (knockbackDistance * knockbackDirection);
                
                // Get route boundaries to clamp knockback
                var route = ctx.Db.EnemyRoute.route_id.Find(enemy.route_id);
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
                ctx.Db.Enemy.enemy_id.Update(damagedEnemy);

                // Record damage event
                ctx.Db.EnemyDamageEvent.Insert(new EnemyDamageEvent
                {
                    enemy_id = enemy.enemy_id,
                    player_identity = ctx.Sender,
                    damage_amount = damageResult.finalDamage,
                    damage_type = damageResult.type,
                    timestamp = ctx.Timestamp
                });

                damageCount++;

                // Award experience if enemy was killed
                if (wasKilled)
                {
                    ExperienceService.AwardExperienceForKill(ctx, enemy);
                    killCount++;
                }

                Log.Info($"Player {ctx.Sender} used {attackType} dealing {damageResult.finalDamage} {damageResult.type} damage to enemy {enemy.enemy_id}. HP: {oldHp} -> {newHp}" + (wasKilled ? " [KILLED]" : ""));
            }
            else
            {
                // Record immune event
                ctx.Db.EnemyDamageEvent.Insert(new EnemyDamageEvent
                {
                    enemy_id = enemy.enemy_id,
                    player_identity = ctx.Sender,
                    damage_amount = 0,
                    damage_type = DamageType.Immune,
                    timestamp = ctx.Timestamp
                });

                Log.Info($"Player {ctx.Sender} {attackType} was immune against enemy {enemy.enemy_id}");
            }
        }

        Log.Info($"Player {ctx.Sender} attack hit {damageCount} enemies, killed {killCount}");
    }

}