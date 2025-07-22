using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

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

    [Table(Name = "EnemyRoute", Public = true)]
    public partial struct EnemyRoute
    {
        [PrimaryKey, AutoInc]
        public uint route_id;
        public string enemy_type;
        public DbRect spawn_area;
        public byte max_enemies;
    }

    [Table(Name = "Enemy", Public = true)]
    public partial struct Enemy
    {
        [PrimaryKey, AutoInc]
        public uint enemy_id;
        public uint route_id;
        public string enemy_type;
        public DbVector2 position;
        public float current_hp;
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

    [SpacetimeDB.Type]
    public partial struct DbRect
    {
        public float x;
        public float y;
        public float width;
        public float height;

        public DbRect(float x, float y, float width, float height)
        {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }

        public DbVector2 GetRandomPoint(Random random)
        {
            // For 2D platformer: spawn enemies on the top surface of the platform
            // X is random within the width, Y is at the top of the spawn area
            return new DbVector2(
                x + (float)random.NextDouble() * width,
                y // Spawn at the top Y coordinate of the platform
            );
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

    [Reducer]
    public static void InitializeEnemyRoutes(ReducerContext ctx, string tilemapJson)
    {
        // Initialize enemy routes based on tilemap JSON data passed as parameter
        // Client should read playground.tmj file and pass the content to this reducer

        // Clear existing routes first
        var routesToRemove = new List<uint>();
        foreach (var route in ctx.Db.EnemyRoute.Iter())
        {
            routesToRemove.Add(route.route_id);
        }
        foreach (var id in routesToRemove)
        {
            ctx.Db.EnemyRoute.route_id.Delete(id);
        }

        try
        {
            using var doc = JsonDocument.Parse(tilemapJson);

            var layers = doc.RootElement.GetProperty("layers");
            var routesList = new List<EnemyRoute>();

            foreach (var layer in layers.EnumerateArray())
            {
                if (layer.GetProperty("name").GetString() == "Enemies")
                {
                    var objects = layer.GetProperty("objects");
                    foreach (var obj in objects.EnumerateArray())
                    {
                        var properties = obj.GetProperty("properties");
                        string enemyType = "";
                        byte maxEnemies = 1;

                        foreach (var prop in properties.EnumerateArray())
                        {
                            string propName = prop.GetProperty("name").GetString();
                            string propValue = prop.GetProperty("value").GetString();

                            if (propName == "enemy")
                                enemyType = propValue;
                            else if (propName == "number")
                                byte.TryParse(propValue, out maxEnemies);
                        }

                        if (!string.IsNullOrEmpty(enemyType))
                        {
                            float x = obj.GetProperty("x").GetSingle();
                            float y = obj.GetProperty("y").GetSingle();
                            float width = obj.GetProperty("width").GetSingle();
                            float height = obj.GetProperty("height").GetSingle();

                            var route = new EnemyRoute
                            {
                                enemy_type = enemyType,
                                spawn_area = new DbRect(x, y, width, height),
                                max_enemies = maxEnemies
                            };

                            routesList.Add(route);
                        }
                    }
                    break;
                }
            }

            foreach (var route in routesList)
            {
                ctx.Db.EnemyRoute.Insert(route);
                Log.Info($"Initialized enemy route: {route.enemy_type} (max: {route.max_enemies}) at ({route.spawn_area.x}, {route.spawn_area.y})");
            }

            Log.Info($"Initialized {routesList.Count} enemy routes from tilemap");
        }
        catch (Exception ex)
        {
            Log.Info($"Error parsing tilemap JSON: {ex.Message}");
        }
    }

    [Reducer]
    public static void SpawnAllEnemies(ReducerContext ctx)
    {
        // Clear all existing enemies first
        var enemiesToRemove = new List<uint>();
        foreach (var enemy in ctx.Db.Enemy.Iter())
        {
            enemiesToRemove.Add(enemy.enemy_id);
        }

        foreach (var id in enemiesToRemove)
        {
            ctx.Db.Enemy.enemy_id.Delete(id);
        }

        if (enemiesToRemove.Count > 0)
        {
            Log.Info($"Cleared {enemiesToRemove.Count} existing enemies");
        }

        // Get enemy stats from enemy_attributes.json (hardcoded for now)
        float enemyMaxHp = 100f; // TODO: Load from enemy_attributes.json

        var random = new Random();
        int totalSpawned = 0;

        // Spawn enemies for all routes
        foreach (var route in ctx.Db.EnemyRoute.Iter())
        {
            for (byte i = 0; i < route.max_enemies; i++)
            {
                var spawnPosition = route.spawn_area.GetRandomPoint(random);

                var newEnemy = new Enemy
                {
                    route_id = route.route_id,
                    enemy_type = route.enemy_type,
                    position = spawnPosition,
                    current_hp = enemyMaxHp
                };

                ctx.Db.Enemy.Insert(newEnemy);
                Log.Info($"Spawned {route.enemy_type} at ({spawnPosition.x}, {spawnPosition.y}) for route {route.route_id}");
                totalSpawned++;
            }
        }

        Log.Info($"Spawned {totalSpawned} enemies across all routes");
    }

}
