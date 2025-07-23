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
}