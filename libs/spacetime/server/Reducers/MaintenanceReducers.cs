using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    [Reducer]
    public static void CleanupDeadBodies(ReducerContext ctx, CleanupDeadBodiesTimer timer)
    {
        // Skip cleanup if no players are connected
        var playerCount = 0;
        foreach (var _ in ctx.Db.Player.Iter())
        {
            playerCount++;
        }
        if (playerCount == 0)
        {
            return;
        }
        
        var fiveSecondsAgo = ctx.Timestamp - TimeSpan.FromSeconds(5);
        var enemiesToRemove = new List<uint>();
        
        foreach (var enemy in ctx.Db.Enemy.Iter())
        {
            // Check if enemy is dead AND has been dead for > 5 seconds
            if (enemy.state == PlayerState.Dead && 
                enemy.last_updated < fiveSecondsAgo)
            {
                enemiesToRemove.Add(enemy.enemy_id);
            }
        }
        
        // Delete all expired dead bodies
        foreach (var enemyId in enemiesToRemove)
        {
            ctx.Db.Enemy.enemy_id.Delete(enemyId);
        }
        
        if (enemiesToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {enemiesToRemove.Count} dead enemies");
        }
    }

    [Reducer]
    public static void Debug(ReducerContext ctx)
    {
        var playerCount = 0;
        foreach (var _ in ctx.Db.Player.Iter())
        {
            playerCount++;
        }
        
        var enemyCount = 0;
        foreach (var _ in ctx.Db.Enemy.Iter())
        {
            enemyCount++;
        }
        
        var routeCount = 0;
        foreach (var _ in ctx.Db.EnemyRoute.Iter())
        {
            routeCount++;
        }
        
        Log.Info($"Debug info - Players: {playerCount}, Enemies: {enemyCount}, Routes: {routeCount}");
    }

    [Reducer]
    public static void SpawnMissingEnemies(ReducerContext ctx, SpawnEnemiesTimer timer)
    {
        // Skip spawning if no players are connected
        var playerCount = 0;
        foreach (var _ in ctx.Db.Player.Iter())
        {
            playerCount++;
        }
        if (playerCount == 0)
        {
            return;
        }

        var random = new Random();
        int totalSpawned = 0;
        const float enemyMaxHp = 100.0f; // Base health for all enemies

        // Check each route and spawn missing enemies if interval has passed
        foreach (var route in ctx.Db.EnemyRoute.Iter())
        {
            // Check if this route is due for spawning
            var intervalAgo = ctx.Timestamp - TimeSpan.FromSeconds(route.spawn_interval);
            
            if (route.last_spawn_time < intervalAgo)
            {
                // Count current alive enemies for this route
                var currentEnemyCount = 0;
                foreach (var enemy in ctx.Db.Enemy.Iter())
                {
                    if (enemy.route_id == route.route_id && enemy.state != PlayerState.Dead)
                    {
                        currentEnemyCount++;
                    }
                }

                // Spawn missing enemies to reach max_enemies limit
                var enemiesToSpawn = route.max_enemies - currentEnemyCount;
                for (int i = 0; i < enemiesToSpawn; i++)
                {
                    var spawnPosition = route.spawn_area.GetRandomPoint(random);

                    var newEnemy = new Enemy
                    {
                        route_id = route.route_id,
                        enemy_type = route.enemy_type,
                        position = spawnPosition,
                        state = PlayerState.Idle,
                        facing = FacingDirection.Right,
                        current_hp = enemyMaxHp,
                        last_updated = ctx.Timestamp
                    };

                    ctx.Db.Enemy.Insert(newEnemy);
                    totalSpawned++;
                }

                // Always update last spawn time when route is due (regardless of whether enemies spawned)
                ctx.Db.EnemyRoute.route_id.Update(new EnemyRoute
                {
                    route_id = route.route_id,
                    enemy_type = route.enemy_type,
                    spawn_area = route.spawn_area,
                    max_enemies = route.max_enemies,
                    spawn_interval = route.spawn_interval,
                    last_spawn_time = ctx.Timestamp
                });
            }
        }

        if (totalSpawned > 0)
        {
            Log.Info($"Spawned {totalSpawned} missing enemies across routes with individual intervals");
        }
    }
}