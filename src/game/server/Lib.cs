using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    [SpacetimeDB.Type]
    public enum PlayerState : byte
    {
        Idle,
        Walk,
        Attack1,
        Attack2,
        Attack3,
        Climbing,
        Damaged,
        Dead,
        Unknown
    }

    [Table(Name = "Player", Public = true)]
    public partial struct Player
    {
        [PrimaryKey]
        public Identity identity;
        [Unique, AutoInc]
        public uint player_id;
        public string name;
        public DbVector2 position;
        public PlayerState state;
        public long state_timestamp;
        public Timestamp last_active;
    }

    [SpacetimeDB.Type]
    public partial struct DbVector2
    {
        public float x;
        public float y;

        public DbVector2(float x, float y)
        {
            this.x = x;
            this.y = y;
        }
    }


    [Reducer]
    public static void Debug(ReducerContext ctx)
    {
        Log.Info($"This reducer was called by {ctx.Sender}");
    }

    [Reducer]
    public static void UpdatePlayerPosition(ReducerContext ctx, float x, float y)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is not null)
        {
            ctx.Db.Player.identity.Update(new Player
            {
                identity = player.Value.identity,
                player_id = player.Value.player_id,
                name = player.Value.name,
                position = new DbVector2(x, y),
                state = player.Value.state,
                state_timestamp = player.Value.state_timestamp,
                last_active = ctx.Timestamp
            });
            Log.Info($"Updated position for {ctx.Sender} to ({x}, {y})");
        }
    }

    [Reducer]
    public static void UpdatePlayerState(ReducerContext ctx, PlayerState newState)
    {
        var player = ctx.Db.Player.identity.Find(ctx.Sender);
        if (player is not null)
        {
            // Basic validation - prevent attacking while already attacking
            if (IsAttackState(newState) && IsAttackState(player.Value.state))
            {
                Log.Info($"Player {ctx.Sender} tried to attack while already attacking");
                return;
            }

            ctx.Db.Player.identity.Update(new Player
            {
                identity = player.Value.identity,
                player_id = player.Value.player_id,
                name = player.Value.name,
                position = player.Value.position,
                state = newState,
                state_timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                last_active = ctx.Timestamp
            });
            Log.Info($"Updated state for {ctx.Sender} to {newState}");
        }
    }

    private static bool IsAttackState(PlayerState state)
    {
        return state == PlayerState.Attack1 || 
               state == PlayerState.Attack2 || 
               state == PlayerState.Attack3;
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
            state_timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
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

}
