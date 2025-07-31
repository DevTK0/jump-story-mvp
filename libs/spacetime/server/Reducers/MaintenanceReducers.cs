using SpacetimeDB;
using System;
using System.Collections.Generic;

public static partial class Module
{
    // Helper method to count active players
    private static int CountPlayers(ReducerContext ctx)
    {
        var playerCount = 0;
        foreach (var _ in ctx.Db.Player.Iter())
        {
            playerCount++;
        }
        return playerCount;
    }

    // Helper method to process damaged enemy recovery
    private static bool ProcessDamagedEnemyRecovery(ReducerContext ctx, Spawn enemy)
    {
        if (enemy.state != PlayerState.Damaged)
        {
            return false;
        }

        var recoveryTimeAgo = ctx.Timestamp - EnemyConstants.GetRecoveryTimeSpan();
        if (enemy.last_updated < recoveryTimeAgo)
        {
            // Return enemy to idle state
            var idleEnemy = CreateEnemyUpdate(enemy, enemy.x, enemy.y, enemy.moving_right, 
                enemy.aggro_target, enemy.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
            ctx.Db.Spawn.spawn_id.Update(idleEnemy);
        }
        return true; // Processed as damaged enemy
    }

    // Helper method to process aggro detection and validation
    private static (bool hasAggro, bool shouldChase, float targetX, float targetY, Identity? aggroTarget) ProcessAggroDetection(
        ReducerContext ctx, Spawn enemy, Enemy enemyData, float leftBound, float rightBound)
    {

        var hasAggro = enemy.aggro_target.HasValue;
        var shouldChase = false;
        var targetX = enemy.x;
        var targetY = enemy.y;
        var newAggroTarget = enemy.aggro_target;

        if (hasAggro)
        {
            // Check if aggro target still exists and is in range
            var aggroPlayer = enemy.aggro_target.HasValue ? ctx.Db.Player.identity.Find(enemy.aggro_target.Value) : null;
            if (aggroPlayer != null)
            {
                // Maintain aggro if player is within leash distance
                if (IsPlayerInLeashRange(aggroPlayer.Value.x, aggroPlayer.Value.y, enemy.x, enemy.y))
                {
                    shouldChase = true;
                    targetX = aggroPlayer.Value.x;
                    targetY = aggroPlayer.Value.y;
                }
                else
                {
                    // Player left leash range - clear aggro
                    hasAggro = false;
                    newAggroTarget = null;
                }
            }
            else
            {
                // Target player disconnected - clear aggro
                hasAggro = false;
                newAggroTarget = null;
            }
        }
        else if (enemyData.ai_behavior == AiBehavior.Aggressive)
        {
            // Check for nearby players within aggro range
            foreach (var player in ctx.Db.Player.Iter())
            {
                // Skip dead players
                if (player.current_hp <= 0 || player.state == PlayerState.Dead)
                    continue;

                // Calculate distance to player
                var distance = Math.Sqrt(
                    Math.Pow(player.x - enemy.x, 2) + 
                    Math.Pow(player.y - enemy.y, 2)
                );

                // Check if player is within aggro range
                if (distance <= enemyData.aggro_range)
                {
                    hasAggro = true;
                    shouldChase = true;
                    newAggroTarget = player.identity;
                    targetX = player.x;
                    targetY = player.y;
                    break; // Aggro on first valid target found
                }
            }
        }

        return (hasAggro, shouldChase, targetX, targetY, newAggroTarget);
    }

    // Helper method to calculate chase movement
    private static (float newX, bool newMovingRight) CalculateChaseMovement(
        Spawn enemy, float targetX, float targetY, float movement, float leftBound, float rightBound)
    {
        // Chase behavior - try to move towards target
        var proposedX = enemy.x;
        var newMovingRight = enemy.moving_right;
        
        if (targetX > enemy.x)
        {
            proposedX = enemy.x + movement;
            newMovingRight = true;
        }
        else if (targetX < enemy.x)
        {
            proposedX = enemy.x - movement;
            newMovingRight = false;
        }
        
        // Clamp to route boundaries
        proposedX = Math.Max(leftBound, Math.Min(rightBound, proposedX));
        
        // If we can't move closer to the target, step back a bit more
        if (Math.Abs(proposedX - enemy.x) < EnemyConstants.MOVEMENT_EPSILON)
        {
            // Can't move towards target, step back in opposite direction
            var stepBackDistance = movement * EnemyConstants.STEP_BACK_MULTIPLIER;
            return targetX > enemy.x
                ? (Math.Max(enemy.x - stepBackDistance, leftBound), false) // Target right, step left
                : (Math.Min(enemy.x + stepBackDistance, rightBound), true); // Target left, step right
        }
        else
        {
            return (proposedX, newMovingRight);
        }
    }

    // Helper method to calculate patrol movement
    private static (float newX, bool newMovingRight) CalculatePatrolMovement(
        Spawn enemy, float movement, float leftBound, float rightBound)
    {
        float newX = enemy.x;
        bool newMovingRight = enemy.moving_right;

        // Normal patrol behavior
        if (enemy.moving_right)
        {
            newX += movement;
            // Check if we hit the right boundary
            if (newX >= rightBound)
            {
                newX = rightBound;
                newMovingRight = false;
            }
        }
        else
        {
            newX -= movement;
            // Check if we hit the left boundary
            if (newX <= leftBound)
            {
                newX = leftBound;
                newMovingRight = true;
            }
        }

        return (newX, newMovingRight);
    }

    // Helper method to create enemy update struct
    private static Spawn CreateEnemyUpdate(Spawn originalEnemy, float newX, float newY, bool newMovingRight, 
        Identity? newAggroTarget, bool hasAggro, Timestamp currentTimestamp, PlayerState? newState = null)
    {
        var newFacing = newMovingRight ? FacingDirection.Right : FacingDirection.Left;
        
        return new Spawn
        {
            spawn_id = originalEnemy.spawn_id,
            route_id = originalEnemy.route_id,
            enemy = originalEnemy.enemy,
            x = newX,
            y = newY,
            state = newState ?? originalEnemy.state,
            facing = newFacing,
            current_hp = originalEnemy.current_hp,
            max_hp = originalEnemy.max_hp,
            level = originalEnemy.level,
            last_updated = currentTimestamp,
            moving_right = newMovingRight,
            aggro_target = newAggroTarget,
            aggro_start_time = hasAggro ? originalEnemy.aggro_start_time : currentTimestamp,
            enemy_type = originalEnemy.enemy_type
        };
    }

    // Helper method to calculate route boundaries
    private static (float leftBound, float rightBound) CalculateRouteBounds(SpawnRoute route)
    {
        var leftBound = route.spawn_area.position.x;
        var rightBound = route.spawn_area.position.x + route.spawn_area.size.x;
        return (leftBound, rightBound);
    }

    // Helper method to check if player is within leash range
    private static bool IsPlayerInLeashRange(float playerX, float playerY, float enemyX, float enemyY)
    {
        var distanceToPlayer = Math.Sqrt(
            Math.Pow(playerX - enemyX, 2) + 
            Math.Pow(playerY - enemyY, 2)
        );
        
        return distanceToPlayer <= EnemyConstants.LEASH_DISTANCE;
    }

    // Helper method to update enemy if any values changed
    private static void UpdateEnemyIfChanged(ReducerContext ctx, Spawn enemy, float newX, bool newMovingRight, 
        Identity? newAggroTarget, bool hasAggro)
    {
        // Update enemy position and direction if changed
        var positionChanged = Math.Abs(newX - enemy.x) > EnemyConstants.POSITION_EPSILON;
        var directionChanged = newMovingRight != enemy.moving_right;
        var aggroChanged = (newAggroTarget?.Equals(enemy.aggro_target) != true) || (!hasAggro && enemy.aggro_target.HasValue);

        if (positionChanged || directionChanged || aggroChanged)
        {
            var updatedEnemy = CreateEnemyUpdate(enemy, newX, enemy.y, newMovingRight, newAggroTarget, hasAggro, ctx.Timestamp);
            ctx.Db.Spawn.spawn_id.Update(updatedEnemy);
        }
    }

    [Reducer]
    public static void CleanupDeadBodies(ReducerContext ctx, CleanupDeadBodiesTimer timer)
    {
        // Skip cleanup if no players are connected
        if (CountPlayers(ctx) == 0)
        {
            return;
        }
        
        var fiveSecondsAgo = ctx.Timestamp - EnemyConstants.GetCleanupTimeSpan();
        var enemiesToRemove = new List<uint>();
        
        foreach (var enemy in ctx.Db.Spawn.Iter())
        {
            // Check if enemy is dead AND has been dead for > 5 seconds
            if (enemy.state == PlayerState.Dead && 
                enemy.last_updated < fiveSecondsAgo)
            {
                enemiesToRemove.Add(enemy.spawn_id);
            }
        }
        
        // Delete all expired dead bodies and their associated damage events
        foreach (var spawnId in enemiesToRemove)
        {
            // First, delete all damage events for this enemy
            var damageEventsToRemove = new List<uint>();
            foreach (var damageEvent in ctx.Db.EnemyDamageEvent.Iter())
            {
                if (damageEvent.spawn_id == spawnId)
                {
                    damageEventsToRemove.Add(damageEvent.damage_event_id);
                }
            }
            
            foreach (var damageEventId in damageEventsToRemove)
            {
                ctx.Db.EnemyDamageEvent.damage_event_id.Delete(damageEventId);
            }
            
            // Then delete the enemy
            ctx.Db.Spawn.spawn_id.Delete(spawnId);
        }
        
        if (enemiesToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {enemiesToRemove.Count} dead enemies");
        }
        
        // Also clean up old player damage events (older than 5 seconds)
        var playerDamageEventsToRemove = new List<uint>();
        foreach (var playerDamageEvent in ctx.Db.PlayerDamageEvent.Iter())
        {
            if (playerDamageEvent.timestamp < fiveSecondsAgo)
            {
                playerDamageEventsToRemove.Add(playerDamageEvent.damage_event_id);
            }
        }
        
        foreach (var damageEventId in playerDamageEventsToRemove)
        {
            ctx.Db.PlayerDamageEvent.damage_event_id.Delete(damageEventId);
        }
        
        if (playerDamageEventsToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {playerDamageEventsToRemove.Count} old player damage events");
        }
    }

    [Reducer]
    public static void Debug(ReducerContext ctx, string adminApiKey)
    {
        // Validate admin API key
        if (!AdminConstants.IsValidAdminKey(adminApiKey))
        {
            Log.Warn($"Unauthorized attempt to call debug from {ctx.Sender}");
            return;
        }

        var playerCount = 0;
        foreach (var _ in ctx.Db.Player.Iter())
        {
            playerCount++;
        }
        
        var enemyCount = 0;
        foreach (var _ in ctx.Db.Spawn.Iter())
        {
            enemyCount++;
        }
        
        var routeCount = 0;
        foreach (var _ in ctx.Db.SpawnRoute.Iter())
        {
            routeCount++;
        }
        
        Log.Info($"Debug info - Players: {playerCount}, Enemies: {enemyCount}, Routes: {routeCount}");
    }

    [Reducer]
    public static void SpawnMissingEnemies(ReducerContext ctx, SpawnEnemiesTimer timer)
    {
        // Skip spawning if no players are connected
        if (CountPlayers(ctx) == 0)
        {
            return;
        }

        var random = new Random();
        var totalSpawned = 0;

        // Check each route and spawn missing enemies if interval has passed
        foreach (var route in ctx.Db.SpawnRoute.Iter())
        {
            // Check if this route is due for spawning
            var intervalAgo = ctx.Timestamp - TimeSpan.FromSeconds(route.spawn_interval);
            
            if (route.last_spawn_time < intervalAgo)
            {
                // Get enemy data from database
                var enemyData = ctx.Db.Enemy.name.Find(route.enemy);
                if (enemyData == null)
                {
                    Log.Warn($"No enemy found for type: {route.enemy}, skipping spawn");
                    continue;
                }

                // Count current alive enemies for this route
                var currentEnemyCount = 0;
                foreach (var enemy in ctx.Db.Spawn.Iter())
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

                    var baseEnemy = new Spawn
                    {
                        route_id = route.route_id,
                        enemy = route.enemy,
                        current_hp = enemyData.Value.health,
                        level = enemyData.Value.level,
                        aggro_start_time = ctx.Timestamp
                    };
                    
                    var newEnemy = CreateEnemyUpdate(baseEnemy, spawnPosition.x, spawnPosition.y, true, null, false, ctx.Timestamp, PlayerState.Idle);

                    ctx.Db.Spawn.Insert(newEnemy);
                    totalSpawned++;
                }

                // Always update last spawn time when route is due (regardless of whether enemies spawned)
                var updatedRoute = route with { last_spawn_time = ctx.Timestamp };
                ctx.Db.SpawnRoute.route_id.Update(updatedRoute);
            }
        }

        if (totalSpawned > 0)
        {
            Log.Info($"Spawned {totalSpawned} missing enemies across routes with individual intervals");
        }
    }

    [Reducer]
    public static void UpdateEnemyPatrol(ReducerContext ctx, EnemyPatrolTimer timer)
    {
        // Skip patrol if no players are connected
        if (CountPlayers(ctx) == 0)
        {
            return;
        }

        const float deltaTime = EnemyConstants.DELTA_TIME;

        foreach (var enemy in ctx.Db.Spawn.Iter())
        {
            // Handle damaged enemies - recover them after 500ms
            if (ProcessDamagedEnemyRecovery(ctx, enemy))
            {
                continue;
            }

            // Only process idle enemies
            if (enemy.state != PlayerState.Idle)
            {
                continue;
            }

            // Get the route for this enemy
            var route = ctx.Db.SpawnRoute.route_id.Find(enemy.route_id);
            if (route == null)
            {
                continue;
            }

            // Get enemy data for behavior and movement speed
            var enemyData = ctx.Db.Enemy.name.Find(enemy.enemy);
            if (enemyData == null)
            {
                Log.Warn($"No enemy found for type: {enemy.enemy}");
                continue;
            }

            // Calculate route boundaries
            var (leftBound, rightBound) = CalculateRouteBounds(route.Value);

            // Process aggro detection and validation
            var (hasAggro, shouldChase, targetX, targetY, newAggroTarget) = ProcessAggroDetection(ctx, enemy, enemyData.Value, leftBound, rightBound);
            
            // Calculate new position based on behavior
            var movement = enemyData.Value.move_speed * deltaTime;
            float newX;
            bool newMovingRight;

            if (shouldChase)
            {
                (newX, newMovingRight) = CalculateChaseMovement(enemy, targetX, targetY, movement, leftBound, rightBound);
            }
            else if (enemyData.Value.ai_behavior == AiBehavior.Patrol && !hasAggro)
            {
                (newX, newMovingRight) = CalculatePatrolMovement(enemy, movement, leftBound, rightBound);
            }
            else
            {
                (newX, newMovingRight) = (enemy.x, enemy.moving_right);
            }

            // Update enemy if any values changed
            UpdateEnemyIfChanged(ctx, enemy, newX, newMovingRight, newAggroTarget, hasAggro);
        }
    }

    [Reducer]
    public static void UpdateLeaderboard(ReducerContext ctx, LeaderboardUpdateTimer timer)
    {
        // Query top 10 players sorted by level (desc) then experience (desc)
        var topPlayers = ctx.Db.Player.Iter()
            .Where(p => !p.ban_status) // Exclude banned players
            .OrderByDescending(p => p.level)
            .ThenByDescending(p => p.experience)
            .Take(10)
            .ToList();

        // Clear existing leaderboard entries
        var existingEntries = ctx.Db.Leaderboard.Iter().ToList();
        foreach (var entry in existingEntries)
        {
            ctx.Db.Leaderboard.rank.Delete(entry.rank);
        }

        // Insert new leaderboard entries
        uint rank = 1;
        foreach (var player in topPlayers)
        {
            // Get job display name
            var job = ctx.Db.Job.job_key.Find(player.job);
            var jobDisplayName = job != null ? job.Value.display_name : player.job; // Fallback to job key if not found

            var leaderboardEntry = new Leaderboard
            {
                rank = rank,
                player_identity = player.identity,
                player_name = player.name,
                level = player.level,
                experience = player.experience,
                job_name = jobDisplayName,
                last_updated = ctx.Timestamp
            };

            ctx.Db.Leaderboard.Insert(leaderboardEntry);
            rank++;
        }

        Log.Info($"Updated leaderboard with {topPlayers.Count} players");
    }

    [Reducer]
    public static void CleanupOldBroadcasts(ReducerContext ctx, BroadcastCleanupTimer timer)
    {
        // Clean up broadcasts older than 15 seconds
        var fifteenSecondsAgo = ctx.Timestamp - TimeSpan.FromSeconds(15);
        var broadcastsToRemove = new List<uint>();

        foreach (var broadcast in ctx.Db.Broadcast.Iter())
        {
            if (broadcast.publish_dt < fifteenSecondsAgo)
            {
                broadcastsToRemove.Add(broadcast.broadcast_id);
            }
        }

        // Delete old broadcasts
        foreach (var broadcastId in broadcastsToRemove)
        {
            ctx.Db.Broadcast.broadcast_id.Delete(broadcastId);
        }

        if (broadcastsToRemove.Count > 0)
        {
            Log.Info($"Cleaned up {broadcastsToRemove.Count} old broadcasts");
        }
    }
}