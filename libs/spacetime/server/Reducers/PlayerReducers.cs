using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    [Reducer(ReducerKind.Init)]
    public static void Init(ReducerContext ctx)
    {
        Log.Info("Initializing module...");
        
        // Schedule dead body cleanup every 1 second
        ctx.Db.cleanup_dead_bodies_timer.Insert(new CleanupDeadBodiesTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(1))
        });
        
        // Schedule enemy spawning every 10 seconds (checks per-route intervals)
        ctx.Db.spawn_enemies_timer.Insert(new SpawnEnemiesTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromSeconds(10))
        });
        
        // Schedule enemy patrol updates every 100ms
        ctx.Db.enemy_patrol_timer.Insert(new EnemyPatrolTimer
        {
            scheduled_at = new ScheduleAt.Interval(TimeSpan.FromMilliseconds(100))
        });
        
        Log.Info("Initialized dead body cleanup, enemy spawning, and enemy patrol schedulers");
    }

    [Reducer(ReducerKind.ClientConnected)]
    public static void Connect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} just connected.");

        // Create player with initial position
        var newPlayer = new Player
        {
            identity = ctx.Sender,
            name = "Player",
            position = new DbVector2(0, 0),
            state = PlayerState.Idle,
            facing = FacingDirection.Right,
            last_active = ctx.Timestamp
        };
        ctx.Db.Player.Insert(newPlayer);
    }

    [Reducer(ReducerKind.ClientDisconnected)]
    public static void Disconnect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} disconnected.");

        // Remove player from database when they disconnect
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is not null)
        {
            ctx.Db.Player.identity.Delete(ctx.Sender);
            Log.Info($"Removed player {ctx.Sender} from database");
        }
    }

    [Reducer]
    public static void UpdatePlayerPosition(ReducerContext ctx, float x, float y, FacingDirection facing)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }

        // Update player position
        ctx.Db.Player.identity.Update(new Player
        {
            identity = player.Value.identity,
            player_id = player.Value.player_id,
            name = player.Value.name,
            position = new DbVector2(x, y),
            state = player.Value.state,
            facing = facing,
            last_active = ctx.Timestamp
        });
        Log.Info($"Updated position for {ctx.Sender} to ({x}, {y}) facing {facing}");
    }

    [Reducer]
    public static void UpdatePlayerState(ReducerContext ctx, PlayerState newState)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is null)
        {
            Log.Info($"Player not found: {ctx.Sender}");
            return;
        }

        // Only transition to valid states from attack states
        if (IsAttackState(player.Value.state) && newState != PlayerState.Idle)
        {
            Log.Info($"Invalid state transition from {player.Value.state} to {newState}");
            return;
        }

        // Update player state
        ctx.Db.Player.identity.Update(new Player
        {
            identity = player.Value.identity,
            player_id = player.Value.player_id,
            name = player.Value.name,
            position = player.Value.position,
            state = newState,
            facing = player.Value.facing,
            last_active = ctx.Timestamp
        });
        Log.Info($"Updated state for {ctx.Sender} to {newState}");
    }

    [Reducer]
    public static void CleanupInactivePlayers(ReducerContext ctx)
    {
        // Manual cleanup - remove all players (for testing purposes)
        // In production, this would have time-based logic
        var playersToRemove = new List<Identity>();

        foreach (var player in ctx.Db.Player.Iter())
        {
            playersToRemove.Add(player.identity);
        }

        foreach (var identity in playersToRemove)
        {
            ctx.Db.Player.identity.Delete(identity);
            Log.Info($"Cleaned up player {identity}");
        }

        if (playersToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {playersToRemove.Count} players");
        }
    }

    private static bool IsAttackState(PlayerState state)
    {
        return state == PlayerState.Attack1 ||
               state == PlayerState.Attack2 ||
               state == PlayerState.Attack3;
    }
}