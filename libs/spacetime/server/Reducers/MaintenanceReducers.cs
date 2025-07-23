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
    private static bool ProcessDamagedEnemyRecovery(ReducerContext ctx, Enemy enemy)
    {
        if (enemy.state != PlayerState.Damaged)
        {
            return false;
        }

        var recoveryTimeAgo = ctx.Timestamp - EnemyConstants.GetRecoveryTimeSpan();
        if (enemy.last_updated < recoveryTimeAgo)
        {
            // Return enemy to idle state
            var idleEnemy = CreateEnemyUpdate(enemy, enemy.position, enemy.moving_right, 
                enemy.aggro_target, enemy.aggro_target.HasValue, ctx.Timestamp, PlayerState.Idle);
            ctx.Db.Enemy.enemy_id.Update(idleEnemy);
        }
        return true; // Processed as damaged enemy
    }

    // Helper method to process aggro detection and validation
    private static (bool hasAggro, bool shouldChase, DbVector2 targetPosition, Identity? aggroTarget) ProcessAggroDetection(
        ReducerContext ctx, Enemy enemy, float leftBound, float rightBound)
    {

        var hasAggro = enemy.aggro_target.HasValue;
        var shouldChase = false;
        var targetPosition = enemy.position;
        var newAggroTarget = enemy.aggro_target;

        if (hasAggro)
        {
            // Check if aggro target still exists and is in range
            var aggroPlayer = ctx.Db.Player.identity.Find(enemy.aggro_target.Value);
            if (aggroPlayer != null)
            {
                // Maintain aggro if player is within leash distance from spawn area
                if (IsPlayerInLeashRange(aggroPlayer.Value.position, enemy.position, leftBound, rightBound))
                {
                    shouldChase = true;
                    targetPosition = aggroPlayer.Value.position;
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
        // Note: Enemies only aggro when attacked, not by proximity
        // Proximity aggro removed - aggro is set in CombatReducers when enemy is attacked

        return (hasAggro, shouldChase, targetPosition, newAggroTarget);
    }

    // Helper method to calculate chase movement
    private static (float newX, bool newMovingRight) CalculateChaseMovement(
        Enemy enemy, DbVector2 targetPosition, float movement, float leftBound, float rightBound)
    {
        // Chase behavior - try to move towards target
        var targetX = targetPosition.x;
        var proposedX = enemy.position.x;
        var newMovingRight = enemy.moving_right;
        
        if (targetX > enemy.position.x)
        {
            proposedX = enemy.position.x + movement;
            newMovingRight = true;
        }
        else if (targetX < enemy.position.x)
        {
            proposedX = enemy.position.x - movement;
            newMovingRight = false;
        }
        
        // Clamp to route boundaries
        proposedX = Math.Max(leftBound, Math.Min(rightBound, proposedX));
        
        // If we can't move closer to the target, step back a bit more
        if (Math.Abs(proposedX - enemy.position.x) < EnemyConstants.MOVEMENT_EPSILON)
        {
            // Can't move towards target, step back in opposite direction
            var stepBackDistance = movement * EnemyConstants.STEP_BACK_MULTIPLIER;
            return targetX > enemy.position.x
                ? (Math.Max(enemy.position.x - stepBackDistance, leftBound), false) // Target right, step left
                : (Math.Min(enemy.position.x + stepBackDistance, rightBound), true); // Target left, step right
        }
        else
        {
            return (proposedX, newMovingRight);
        }
    }

    // Helper method to calculate patrol movement
    private static (float newX, bool newMovingRight) CalculatePatrolMovement(
        Enemy enemy, float movement, float leftBound, float rightBound)
    {
        float newX = enemy.position.x;
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
    private static Enemy CreateEnemyUpdate(Enemy originalEnemy, DbVector2 newPosition, bool newMovingRight, 
        Identity? newAggroTarget, bool hasAggro, Timestamp currentTimestamp, PlayerState? newState = null)
    {
        var newFacing = newMovingRight ? FacingDirection.Right : FacingDirection.Left;
        
        return new Enemy
        {
            enemy_id = originalEnemy.enemy_id,
            route_id = originalEnemy.route_id,
            enemy_type = originalEnemy.enemy_type,
            position = newPosition,
            state = newState ?? originalEnemy.state,
            facing = newFacing,
            current_hp = originalEnemy.current_hp,
            last_updated = currentTimestamp,
            moving_right = newMovingRight,
            aggro_target = newAggroTarget,
            aggro_start_time = hasAggro ? originalEnemy.aggro_start_time : currentTimestamp
        };
    }

    // Helper method to calculate route boundaries
    private static (float leftBound, float rightBound) CalculateRouteBounds(EnemyRoute route)
    {
        var leftBound = route.spawn_area.position.x;
        var rightBound = route.spawn_area.position.x + route.spawn_area.size.x;
        return (leftBound, rightBound);
    }

    // Helper method to check if player is within leash range
    private static bool IsPlayerInLeashRange(DbVector2 playerPosition, DbVector2 enemyPosition, float leftBound, float rightBound)
    {
        var distanceToPlayer = Math.Abs(playerPosition.x - enemyPosition.x);
        var spawnCenterX = (leftBound + rightBound) / 2;
        var distanceFromSpawn = Math.Abs(enemyPosition.x - spawnCenterX);
        
        return distanceFromSpawn <= EnemyConstants.LEASH_DISTANCE && distanceToPlayer <= EnemyConstants.LEASH_DISTANCE;
    }

    // Helper method to update enemy if any values changed
    private static void UpdateEnemyIfChanged(ReducerContext ctx, Enemy enemy, float newX, bool newMovingRight, 
        Identity? newAggroTarget, bool hasAggro)
    {
        // Update enemy position and direction if changed
        var positionChanged = Math.Abs(newX - enemy.position.x) > EnemyConstants.POSITION_EPSILON;
        var directionChanged = newMovingRight != enemy.moving_right;
        var aggroChanged = (newAggroTarget?.Equals(enemy.aggro_target) != true) || (!hasAggro && enemy.aggro_target.HasValue);

        if (positionChanged || directionChanged || aggroChanged)
        {
            var newPosition = new DbVector2(newX, enemy.position.y);
            var updatedEnemy = CreateEnemyUpdate(enemy, newPosition, newMovingRight, newAggroTarget, hasAggro, ctx.Timestamp);
            ctx.Db.Enemy.enemy_id.Update(updatedEnemy);
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
        if (CountPlayers(ctx) == 0)
        {
            return;
        }

        var random = new Random();
        var totalSpawned = 0;
        const float enemyMaxHp = EnemyConstants.ENEMY_MAX_HP;

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

                    var baseEnemy = new Enemy
                    {
                        route_id = route.route_id,
                        enemy_type = route.enemy_type,
                        current_hp = enemyMaxHp,
                        aggro_start_time = ctx.Timestamp
                    };
                    
                    var newEnemy = CreateEnemyUpdate(baseEnemy, spawnPosition, true, null, false, ctx.Timestamp, PlayerState.Idle);

                    ctx.Db.Enemy.Insert(newEnemy);
                    totalSpawned++;
                }

                // Always update last spawn time when route is due (regardless of whether enemies spawned)
                var updatedRoute = route with { last_spawn_time = ctx.Timestamp };
                ctx.Db.EnemyRoute.route_id.Update(updatedRoute);
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

        const float patrolSpeed = EnemyConstants.PATROL_SPEED;
        const float deltaTime = EnemyConstants.DELTA_TIME;

        foreach (var enemy in ctx.Db.Enemy.Iter())
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
            var route = ctx.Db.EnemyRoute.route_id.Find(enemy.route_id);
            if (route == null)
            {
                continue;
            }

            // Calculate route boundaries
            var (leftBound, rightBound) = CalculateRouteBounds(route.Value);

            // Process aggro detection and validation
            var (hasAggro, shouldChase, targetPosition, newAggroTarget) = ProcessAggroDetection(ctx, enemy, leftBound, rightBound);
            
            // Calculate new position based on behavior
            var movement = patrolSpeed * deltaTime;
            float newX;
            bool newMovingRight;

            if (shouldChase)
            {
                (newX, newMovingRight) = CalculateChaseMovement(enemy, targetPosition, movement, leftBound, rightBound);
            }
            else if (route.Value.behavior == "patrol" && !hasAggro)
            {
                (newX, newMovingRight) = CalculatePatrolMovement(enemy, movement, leftBound, rightBound);
            }
            else
            {
                (newX, newMovingRight) = (enemy.position.x, enemy.moving_right);
            }

            // Update enemy if any values changed
            UpdateEnemyIfChanged(ctx, enemy, newX, newMovingRight, newAggroTarget, hasAggro);
        }
    }
}