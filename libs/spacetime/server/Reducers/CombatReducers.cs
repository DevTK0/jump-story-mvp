using SpacetimeDB;
using System;

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
            var newHp = Math.Max(0, enemy.Value.current_hp - damageResult.finalDamage);
            var newState = newHp <= 0 ? PlayerState.Dead : PlayerState.Damaged;

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
            ctx.Db.DamageEvent.Insert(new DamageEvent
            {
                enemy_id = enemyId,
                player_identity = ctx.Sender,
                damage_amount = damageResult.finalDamage,
                damage_type = damageResult.type,
                timestamp = ctx.Timestamp
            });

            Log.Info($"Player {ctx.Sender} used {attackType} dealing {damageResult.finalDamage} {damageResult.type} damage to enemy {enemyId}. HP: {enemy.Value.current_hp} -> {newHp}");
        }
        else
        {
            // Record immune event
            ctx.Db.DamageEvent.Insert(new DamageEvent
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
}