using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    [Table(Name = "player", Public = true)]
    public partial struct Player
    {
        [PrimaryKey]
        public Identity identity;
        [Unique, AutoInc]
        public uint player_id;
        public string name;
        public DbVector2 position;
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
        var player = ctx.Db.player.identity.Find(ctx.Sender);
        if (player is not null)
        {
            ctx.Db.player.identity.Update(new Player
            {
                identity = player.Value.identity,
                player_id = player.Value.player_id,
                name = player.Value.name,
                position = new DbVector2(x, y),
                last_active = ctx.Timestamp
            });
            Log.Info($"Updated position for {ctx.Sender} to ({x}, {y})");
        }
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
            last_active = ctx.Timestamp
        };
        ctx.Db.player.Insert(newPlayer);
    }

    [Reducer(ReducerKind.ClientDisconnected)]
    public static void Disconnect(ReducerContext ctx)
    {
        Log.Info($"{ctx.Sender} disconnected.");
        
        // Remove player from database when they disconnect
        var player = ctx.Db.player.identity.Find(ctx.Sender);
        if (player is not null)
        {
            ctx.Db.player.identity.Delete(ctx.Sender);
            Log.Info($"Removed player {ctx.Sender} from database");
        }
    }

    [Reducer]
    public static void CleanupInactivePlayers(ReducerContext ctx)
    {
        // Manual cleanup - remove all players (for testing purposes)
        // In production, this would have time-based logic
        var playersToRemove = new List<Identity>();
        
        foreach (var player in ctx.Db.player.Iter())
        {
            playersToRemove.Add(player.identity);
        }
        
        foreach (var identity in playersToRemove)
        {
            ctx.Db.player.identity.Delete(identity);
            Log.Info($"Cleaned up player {identity}");
        }
        
        if (playersToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {playersToRemove.Count} players");
        }
    }

}
