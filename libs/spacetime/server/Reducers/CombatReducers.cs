using SpacetimeDB;
using System;

public static partial class Module
{
    [Reducer]
    public static void DamageEnemy(ReducerContext ctx, uint enemyId, AttackType attackType)
    {
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
            var newState = newHp <= 0 ? PlayerState.Dead : enemy.Value.state; // Keep existing state unless dead

            // Update enemy health and state
            ctx.Db.Enemy.enemy_id.Update(new Enemy
            {
                enemy_id = enemy.Value.enemy_id,
                route_id = enemy.Value.route_id,
                enemy_type = enemy.Value.enemy_type,
                position = enemy.Value.position,
                state = newState,
                facing = enemy.Value.facing,
                current_hp = newHp,
                last_updated = ctx.Timestamp
            });

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
}