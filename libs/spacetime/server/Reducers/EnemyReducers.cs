using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

public static partial class Module
{
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
                        var enemyType = "";
                        byte maxEnemies = 1;
                        var spawnInterval = EnemyConstants.DEFAULT_SPAWN_INTERVAL;
                        foreach (var prop in properties.EnumerateArray())
                        {
                            string propName = prop.GetProperty("name").GetString();
                            string propValue = prop.GetProperty("value").GetString();

                            if (propName == "enemy")
                                enemyType = propValue;
                            else if (propName == "number")
                                byte.TryParse(propValue, out maxEnemies);
                            else if (propName == "spawn_interval")
                                uint.TryParse(propValue, out spawnInterval);
                        }

                        // Behavior will be populated from database - default to patrol for now
                        string behavior = "patrol";

                        if (!string.IsNullOrEmpty(enemyType))
                        {
                            var x = obj.GetProperty("x").GetSingle();
                            var y = obj.GetProperty("y").GetSingle();
                            var width = obj.GetProperty("width").GetSingle();
                            var height = obj.GetProperty("height").GetSingle();

                            var route = new EnemyRoute
                            {
                                enemy_type = enemyType,
                                spawn_area = new DbRect(
                                    new DbVector2(x, y),
                                    new DbVector2(width, height)
                                ),
                                max_enemies = maxEnemies,
                                spawn_interval = spawnInterval,
                                last_spawn_time = ctx.Timestamp,
                                behavior = behavior
                            };

                            routesList.Add(route);
                        }
                    }
                    break;
                }
            }

            // Insert all routes into the database
            foreach (var route in routesList)
            {
                ctx.Db.EnemyRoute.Insert(route);
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
        // Clear existing enemies first
        var enemiesToRemove = new List<uint>();
        foreach (var enemy in ctx.Db.Enemy.Iter())
        {
            enemiesToRemove.Add(enemy.enemy_id);
        }

        foreach (var enemyId in enemiesToRemove)
        {
            ctx.Db.Enemy.enemy_id.Delete(enemyId);
        }

        Log.Info($"Cleared {enemiesToRemove.Count} existing enemies");

        // Spawn new enemies based on routes
        var random = new Random();
        var totalSpawned = 0;

        const float enemyMaxHp = EnemyConstants.ENEMY_MAX_HP;

        // Spawn enemies for all routes
        foreach (var route in ctx.Db.EnemyRoute.Iter())
        {
            for (byte i = 0; i < route.max_enemies; i++)
            {
                var spawnPosition = route.spawn_area.GetRandomPoint(random);

                var baseEnemy = new Enemy
                {
                    route_id = route.route_id,
                    enemy_type = route.enemy_type,
                    current_hp = enemyMaxHp,
                    aggro_start_time = ctx.Timestamp
                };
                
                var newEnemy = CreateEnemyUpdate(baseEnemy, spawnPosition, true, null, false, ctx.Timestamp, PlayerState.Idle);

                ctx.Db.Enemy.Insert(newEnemy);
                Log.Info($"Spawned {route.enemy_type} at ({spawnPosition.x}, {spawnPosition.y}) for route {route.route_id}");
                totalSpawned++;
            }
        }

        Log.Info($"Spawned {totalSpawned} enemies across all routes");
    }

}