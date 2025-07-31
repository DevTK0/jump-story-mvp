using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

public static partial class Module
{
    [Reducer]
    public static void InitializeEnemyRoutes(ReducerContext ctx, string adminApiKey, string tilemapJson)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to initialize enemy routes from {ctx.Sender}");
            return;
        }

        // Initialize enemy routes based on tilemap JSON data passed as parameter
        // Client should read playground.tmj file and pass the content to this reducer

        // Clear existing routes first
        var routesToRemove = new List<uint>();
        foreach (var route in ctx.Db.SpawnRoute.Iter())
        {
            routesToRemove.Add(route.route_id);
        }
        foreach (var id in routesToRemove)
        {
            ctx.Db.SpawnRoute.route_id.Delete(id);
        }

        try
        {
            using var doc = JsonDocument.Parse(tilemapJson);

            var layers = doc.RootElement.GetProperty("layers");
            var routesList = new List<SpawnRoute>();

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
                            string propName = prop.GetProperty("name").GetString() ?? "";
                            string propValue = prop.GetProperty("value").GetString() ?? "";

                            if (propName == "enemy")
                                enemyType = propValue;
                            else if (propName == "number")
                                byte.TryParse(propValue, out maxEnemies);
                            else if (propName == "spawn_interval")
                                uint.TryParse(propValue, out spawnInterval);
                        }

                        if (!string.IsNullOrEmpty(enemyType))
                        {
                            var x = obj.GetProperty("x").GetSingle();
                            var y = obj.GetProperty("y").GetSingle();
                            var width = obj.GetProperty("width").GetSingle();
                            var height = obj.GetProperty("height").GetSingle();

                            var route = new SpawnRoute
                            {
                                enemy = enemyType,
                                spawn_area = new DbRect(
                                    new DbVector2(x, y),
                                    new DbVector2(width, height)
                                ),
                                max_enemies = maxEnemies,
                                spawn_interval = spawnInterval,
                                last_spawn_time = ctx.Timestamp
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
                ctx.Db.SpawnRoute.Insert(route);
            }

            Log.Info($"Initialized {routesList.Count} enemy routes from tilemap");
        }
        catch (Exception ex)
        {
            Log.Info($"Error parsing tilemap JSON: {ex.Message}");
        }
    }

    [Reducer]
    public static void SpawnAllEnemies(ReducerContext ctx, string adminApiKey)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to spawn all enemies from {ctx.Sender}");
            return;
        }

        // Clear existing enemies first
        var enemiesToRemove = new List<uint>();
        foreach (var enemy in ctx.Db.Spawn.Iter())
        {
            enemiesToRemove.Add(enemy.spawn_id);
        }

        foreach (var spawnId in enemiesToRemove)
        {
            ctx.Db.Spawn.spawn_id.Delete(spawnId);
        }

        Log.Info($"Cleared {enemiesToRemove.Count} existing enemies");

        // Clear all enemy damage events
        var damageEventsToRemove = new List<uint>();
        foreach (var damageEvent in ctx.Db.EnemyDamageEvent.Iter())
        {
            damageEventsToRemove.Add(damageEvent.damage_event_id);
        }

        foreach (var damageEventId in damageEventsToRemove)
        {
            ctx.Db.EnemyDamageEvent.damage_event_id.Delete(damageEventId);
        }

        if (damageEventsToRemove.Count > 0)
        {
            Log.Info($"Cleared {damageEventsToRemove.Count} enemy damage events");
        }

        // Spawn new enemies based on routes
        var random = new Random();
        var totalSpawned = 0;

        // Spawn enemies for all routes
        foreach (var route in ctx.Db.SpawnRoute.Iter())
        {
            // Get enemy data from database
            var enemyData = ctx.Db.Enemy.name.Find(route.enemy);
            if (enemyData == null)
            {
                Log.Warn($"No enemy found for type: {route.enemy}, skipping route");
                continue;
            }

            for (byte i = 0; i < route.max_enemies; i++)
            {
                var spawnPosition = route.spawn_area.GetRandomPoint(random);

                var baseEnemy = new Spawn
                {
                    route_id = route.route_id,
                    enemy = route.enemy,
                    current_hp = enemyData.Value.health,
                    max_hp = enemyData.Value.health,
                    level = enemyData.Value.level,
                    aggro_start_time = ctx.Timestamp,
                    enemy_type = EnemyType.Regular
                };
                
                var newEnemy = CreateEnemyUpdate(baseEnemy, spawnPosition.x, spawnPosition.y, true, null, false, ctx.Timestamp, PlayerState.Idle);

                ctx.Db.Spawn.Insert(newEnemy);
                Log.Info($"Spawned {route.enemy} (Level {enemyData.Value.level}) at ({spawnPosition.x}, {spawnPosition.y}) for route {route.route_id}");
                totalSpawned++;
            }
        }

        Log.Info($"Spawned {totalSpawned} enemies across all routes");
    }

}